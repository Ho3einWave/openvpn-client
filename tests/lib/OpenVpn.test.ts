import process from 'node:process'
import dotenv from 'dotenv'
import psList from 'ps-list'
import { describe, expect, it } from 'vitest'
import { OpenVpn } from '../../src/lib/OpenVpn'

dotenv.config()

const username = process.env.OVPN_USERNAME!
const password = process.env.OVPN_PASSWORD!
const configPath = process.env.OVPN_CONFIG_PATH!

describe('OpenVpn', () => {
  it('should connect openvpn', { timeout: 15 * 1000 }, async () => {
    const openVpn = new OpenVpn({
      configPath,
      username,
      password,
      useAuthFile: true,
    })
    openVpn.connect()

    await new Promise((resolve) => {
      openVpn.on('status', async (status) => {
        if (status === 'connected') {
          const processes = await psList()
          expect(
            processes.filter((process) => process.name === 'openvpn.exe')
              .length,
          ).toBeGreaterThan(0)
          openVpn.disconnect()
          resolve(true)
        }
      })
    })
  })

  it('should connect and disconnect', { timeout: 15 * 1000 }, async () => {
    const openVpn = new OpenVpn({
      configPath,
      username,
      password,
      useAuthFile: true,
    })
    openVpn.connect()
    await new Promise((resolve) => {
      openVpn.on('status', async (status) => {
        if (status === 'connected') {
          const processes = await psList()
          expect(
            processes.filter((process) => process.name === 'openvpn.exe')
              .length,
          ).toBeGreaterThan(0)

          openVpn.disconnect()
        }
        if (status === 'disconnected') {
          const processes = await psList()
          expect(
            processes.filter((process) => process.name === 'openvpn.exe')
              .length,
          ).toBe(0)
          resolve(true)
        }
      })
    })
  })

  // it(
  //   'should change status when network not available',
  //   { timeout: 60 * 1000 },
  //   async () => {
  //     const openVpn = new OpenVpn(configPath, username, password)
  //     openVpn.connect()
  //     await new Promise((resolve) => {
  //       openVpn.on('status', (status) => {
  //         if (status === 'connected') {
  //           // eslint-disable-next-line no-console
  //           console.log(
  //             '[TEST] Connected, disconnect the internet connection manually',
  //           )
  //         }
  //         if (status === 'reconnecting') {
  //           openVpn.disconnect()
  //           resolve(true)
  //         }
  //       })
  //     })
  //   },
  // )

  it('should connect with custom flags', { timeout: 60 * 1000 }, async () => {
    const openVpn = new OpenVpn({
      configPath,
      username,
      password,
      useAuthFile: true,
      customFlags: ['--auth-nocache'],
    })
    openVpn.connect()
    await new Promise((resolve) => {
      openVpn.on('status', (status) => {
        if (status === 'connected') {
          openVpn.disconnect()
          resolve(true)
        }
      })
    })
  })
})
