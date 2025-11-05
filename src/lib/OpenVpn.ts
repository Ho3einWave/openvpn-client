import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import fkill from 'fkill'
import psList from 'ps-list'
import { OpenvpnExecutableNames } from '../constants/openvpn'
import { sleep } from '../utils/sleep'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'stopped'
  | 'error'
  | 'auth'
  | 'auth_username'
  | 'auth_password'
  | 'auth_success'
  | 'auth_failed'

export class OpenVpn {
  private configPath: string
  private username?: string
  private password?: string
  private authPath?: string
  private useAuthFile?: boolean
  private customFlags?: string[]
  private process?: ChildProcess
  private eventEmitter = new EventEmitter()
  private status: Status = 'stopped'
  private tempDir?: string
  private isTempConfig: boolean = false

  constructor(options: {
    configPath: string
    username?: string
    password?: string
    authPath?: string
    useAuthFile?: boolean
    customFlags?: string[]
  }) {
    this.configPath = options.configPath
    this.username = options.username
    this.password = options.password
    this.useAuthFile = options.useAuthFile
    this.customFlags = options.customFlags
  }

  /**
   * Finalizer to ensure cleanup happens when the object is garbage collected
   * This is a safety net in case the user forgets to call cleanup()
   */
  public [Symbol.for('nodejs.util.inspect.custom')]() {
    // This method is called by Node.js when the object is being inspected
    // We can use it as a finalizer to ensure cleanup
    this.cleanup()
    return this
  }

  public static createFromConfig(options: {
    config: string
    username?: string
    password?: string
    useAuthFile?: boolean
    customFlags?: string[]
  }) {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), `openvpn-client-${Date.now()}`)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Generate a unique filename
    const configFileName = `config-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.ovpn`
    const authFileName = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const configPath = path.join(tempDir, configFileName)
    const authPath = path.join(tempDir, authFileName)

    // Write config to file
    fs.writeFileSync(configPath, options.config, 'utf8')
    if (options.useAuthFile) {
      fs.writeFileSync(
        authPath,
        `${options.username}:${options.password}`,
        'utf8',
      )
    }
    // Return new instance with the temp config path
    const instance = new OpenVpn({
      configPath,
      username: options.username,
      password: options.password,
      authPath,
      useAuthFile: options.useAuthFile,
      customFlags: options.customFlags,
    })
    instance.tempDir = tempDir
    instance.isTempConfig = true
    return instance
  }

  private createAuthFile() {
    // Use existing tempDir if available, otherwise create a new one
    if (!this.tempDir) {
      this.tempDir = path.join(os.tmpdir(), `openvpn-client-${Date.now()}`)
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true })
      }
    }
    const authFileName = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const authPath = path.join(this.tempDir, authFileName)
    fs.writeFileSync(authPath, `${this.username}\n${this.password}`, 'utf8')
    return authPath
  }

  public on(event: 'status', listener: (status: Status) => void): void
  public on(event: 'log', listener: (log: string) => void): void
  public on(event: string, listener: (data: any) => void) {
    this.eventEmitter.on(event, listener)
  }

  private getExecPath() {
    const platform = os.platform()
    if (platform === 'win32') {
      const programFiles = process.env.PROGRAMFILES || ''
      const programFilesX86 = process.env['PROGRAMFILES(X86)'] || ''

      const openvpnPath = path.join(
        programFiles,
        'OpenVPN',
        'bin',
        'openvpn.exe',
      )
      if (fs.existsSync(openvpnPath)) {
        return openvpnPath
      }
      const openvpnPathX86 = path.join(
        programFilesX86,
        'OpenVPN',
        'bin',
        'openvpn.exe',
      )
      if (fs.existsSync(openvpnPathX86)) {
        return openvpnPathX86
      }
      throw new Error('OpenVPN not found')
    } else if (platform === 'darwin') {
      // Common macOS paths
      const macPaths = [
        '/usr/local/sbin/openvpn',
        '/usr/local/bin/openvpn',
        '/opt/homebrew/bin/openvpn',
      ]

      for (const p of macPaths) {
        if (fs.existsSync(p)) {
          return p
        }
      }
    } else {
      // Linux paths
      const linuxPaths = [
        '/usr/sbin/openvpn',
        '/usr/bin/openvpn',
        '/sbin/openvpn',
      ]

      for (const p of linuxPaths) {
        if (fs.existsSync(p)) {
          return p
        }
      }
    }

    // If we get here and OPENVPN_BIN_PATH is set, use that
    if (process.env.OPENVPN_BIN_PATH) {
      const customPath = path.join(process.env.OPENVPN_BIN_PATH, 'openvpn')
      if (fs.existsSync(customPath)) {
        return customPath
      }
    }

    // Last resort: try to find openvpn in PATH
    return 'openvpn'
  }

  private async bootstrap() {
    this.status = 'connecting'
    this.eventEmitter.emit('status', this.status)

    // Try graceful shutdown of current process first
    if (this.process) {
      this.process.kill('SIGINT')
      // Give the current process some time to shut down gracefully
      await sleep(500)
    }

    // Clean up any remaining OpenVPN processes gracefully
    await this.killProcesses(true, 1000)
    this.process = undefined
  }

  public async connect(showConsole = false) {
    await this.bootstrap()
    const execPath = this.getExecPath()
    const args = ['--config', this.configPath]
    if (this.useAuthFile && this.authPath) {
      args.push('--auth-user-pass', this.authPath)
    }
    if (this.useAuthFile && !this.authPath) {
      this.authPath = this.createAuthFile()
      args.push('--auth-user-pass', this.authPath)
    }
    if (this.customFlags && this.customFlags.length > 0) {
      args.push(...this.customFlags)
    }

    const process = spawn(execPath, args, {
      windowsHide: !showConsole,
      detached: showConsole,
    })

    this.process = process

    process.stdout?.on('data', (chunk) => {
      this.handleChunk(chunk)
    })
    process.stderr?.on('data', (chunk) => {
      this.handleChunk(chunk)
    })

    process.on('close', () => {
      this.status = 'disconnected'
      this.eventEmitter.emit('status', this.status)
    })

    process.on('error', (error) => {
      this.status = 'error'
      this.eventEmitter.emit('status', this.status)
      this.eventEmitter.emit('log', `Error: ${error.message}`)
    })

    return new Promise<void>((resolve, reject) => {
      const statusListener = (status: Status) => {
        if (status === 'connected') {
          this.eventEmitter.removeListener('status', statusListener)
          resolve()
        } else if (status === 'error' || status === 'auth_failed') {
          this.eventEmitter.removeListener('status', statusListener)
          reject(new Error(`Connection failed: ${status}`))
        }
      }

      this.eventEmitter.on('status', statusListener)

      // Add timeout to avoid hanging indefinitely
      setTimeout(() => {
        this.eventEmitter.removeListener('status', statusListener)
        if (
          this.status !== 'connected' &&
          this.status !== 'disconnected' &&
          this.status !== 'reconnecting' &&
          this.status !== 'disconnecting'
        ) {
          reject(new Error('Connection timeout'))
          this.disconnect()
        }
      }, 30000) // 30 seconds timeout
    })
  }

  public async disconnect(graceful = true, timeoutMs = 1000) {
    // Set disconnecting status
    if (
      this.status !== 'disconnected' &&
      this.status !== 'stopped' &&
      this.status !== 'disconnecting'
    ) {
      this.status = 'disconnecting'
      this.eventEmitter.emit('status', this.status)
    }

    // Try graceful shutdown first with SIGINT (Ctrl+C equivalent)
    if (this.process && graceful) {
      this.process.kill('SIGINT')
      // Give the current process some time to shut down gracefully
      await sleep(Math.min(500, timeoutMs / 2))
    }

    // Clean up any remaining OpenVPN processes
    await this.killProcesses(graceful, timeoutMs)
    this.process = undefined
    if (
      this.status !== 'disconnected' &&
      this.status !== 'stopped' &&
      this.status !== 'disconnecting'
    ) {
      this.status = 'disconnected'
      this.eventEmitter.emit('status', this.status)
    }

    // Clean up temp config file if it exists
    this.cleanupTempConfig()

    return new Promise((resolve) => {
      setTimeout(resolve, 250)
    })
  }

  /**
   * Manually clean up all temporary files and directories created by this instance
   * This method can be called even when the VPN is not connected
   */
  public cleanup() {
    this.cleanupTempConfig()
  }

  private cleanupTempConfig() {
    try {
      // Clean up individual files if they exist
      if (this.configPath && fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath)
      }
      if (this.authPath && fs.existsSync(this.authPath)) {
        fs.unlinkSync(this.authPath)
      }
    } catch (error) {
      this.eventEmitter.emit('log', `Error cleaning up temp files: ${error}`)
    }

    // Clean up the entire temp directory if it exists and is a temp config
    if (this.tempDir && this.isTempConfig && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true })
      } catch (error) {
        this.eventEmitter.emit(
          'log',
          `Error cleaning up temp directory: ${error}`,
        )
      }
    }
  }

  public async getProcesses() {
    const processes = await psList()
    return processes.filter((process) =>
      OpenvpnExecutableNames.includes(process.name),
    )
  }

  public async killProcesses(graceful = true, timeoutMs = 1000) {
    let processes = await this.getProcesses()

    if (processes.length === 0) {
      return
    }

    if (graceful) {
      // First try graceful shutdown with SIGINT (Ctrl+C equivalent)
      try {
        for (const process of processes) {
          await fkill(process.pid, { force: false })
        }

        // Wait for processes to terminate gracefully
        const startTime = Date.now()
        while (Date.now() - startTime < timeoutMs) {
          await sleep(500)
          processes = await this.getProcesses()
          if (processes.length === 0) {
            return // All processes terminated gracefully
          }
        }
      } catch {
        // If graceful shutdown fails, we'll fall back to force kill
      }
    }

    // Force kill remaining processes if graceful shutdown failed or wasn't requested
    try {
      processes = await this.getProcesses()
      if (processes.length > 0) {
        for (const process of processes) {
          await fkill(process.pid, { force: true })
        }
      }
    } catch {
      await sleep(500)
      processes = await this.getProcesses()
      if (processes.length > 0) {
        await fkill(
          processes.map((process) => process.pid),
          { force: true },
        )
      }
    }
  }

  private handleLog(line: string) {
    this.eventEmitter.emit('log', line)

    if (
      (line.includes('PUSH: Received control message') ||
        line.includes('Initialization Sequence Completed')) &&
      this.status !== 'connected'
    ) {
      this.status = 'connected'
      this.eventEmitter.emit('status', this.status)
    }
    if (line.includes('Exiting')) {
      this.status = 'disconnected'
      this.eventEmitter.emit('status', this.status)
    }
    if (line.includes('Enter Auth Username:')) {
      this.status = 'auth_username'
      this.eventEmitter.emit('status', this.status)
      this.handleAuth('username')
    }
    if (line.includes('Enter Auth Password:')) {
      this.status = 'auth_password'
      this.eventEmitter.emit('status', this.status)
      this.handleAuth('password')
    }
    if (line.includes('Verification Failed') || line.includes('AUTH_FAILED')) {
      this.status = 'auth_failed'
      this.eventEmitter.emit('status', this.status)
    }
    if (line.includes('Peer Connection Initiated')) {
      this.status = 'auth_success'
      this.eventEmitter.emit('status', this.status)
    }
    if (
      line.includes('SIGUSR1[soft,ping-restart] received, process restarting')
    ) {
      this.status = 'reconnecting'
      this.eventEmitter.emit('status', this.status)
    }
    if (
      line.includes('Successful ARP Flush on interface') &&
      this.status === 'reconnecting'
    ) {
      this.status = 'connected'
      this.eventEmitter.emit('status', this.status)
    }
  }

  private handleChunk(chunk: any) {
    const data = chunk.toString()
    // Split on both \r\n (Windows) and \n (Unix) line endings
    const lines = data.split(/\r?\n/)

    for (const line of lines) {
      // Skip empty lines
      if (line.trim()) {
        this.handleLog(line)
      }
    }
  }

  private handleAuth(type: 'username' | 'password') {
    if (type === 'username') {
      if (this.username) {
        this.process?.stdin?.write(`${this.username}\n`)
      } else {
        this.status = 'auth_failed'
        this.eventEmitter.emit('status', this.status)
      }
    }
    if (type === 'password') {
      if (this.password) {
        this.process?.stdin?.write(`${this.password}\n`)
      } else {
        this.status = 'auth_failed'
        this.eventEmitter.emit('status', this.status)
      }
    }
  }
}
