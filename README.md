# OpenVPN Client

A Node.js wrapper for OpenVPN client that provides a simple and programmatic way to manage OpenVPN connections.

## TODO

- [ ] Config Validation - Validate .ovpn files before connecting
- [ ] Multiple Connections - Support multiple simultaneous connections
- [ ] Retry Logic - Automatic retry with configurable attempts and delays
- [ ] Error Handling - Custom error types and specific error codes
- [ ] Connection Stats - Real-time connection metrics and monitoring
- [ ] Config Builder - Programmatic configuration creation
- [ ] Logging - Configurable log levels and file output
- [ ] Health Checks - Connection testing and health monitoring
- [ ] Config Templates - Pre-built templates for common VPN providers
- [ ] Event History - Connection history and event logging
- [ ] Credential Management - Secure credential storage and retrieval
- [ ] Certificate Management - Automatic certificate renewal and validation
- [ ] Performance Metrics - Connection performance and throughput metrics




## Features

- 🔌 **Easy Connection Management** - Connect and disconnect from OpenVPN servers programmatically
- 📡 **Event-Driven Status Updates** - Real-time status monitoring with event emitters
- 🔐 **Authentication Support** - Handle username/password authentication automatically
- 🖥️ **Cross-Platform** - Works on Windows, macOS, and Linux
- 📝 **Config Management** - Support for both file-based and string-based configurations
- 🧹 **Auto Cleanup** - Automatic cleanup of temporary configuration files
- ⚡ **Process Management** - Automatic detection and cleanup of OpenVPN processes

## Installation

```bash
npm install openvpn-client
# or
pnpm add openvpn-client
# or
yarn add openvpn-client
```

## Prerequisites

This library requires OpenVPN to be installed on your system:

### Windows
- Install OpenVPN from [https://openvpn.net/community-downloads/](https://openvpn.net/community-downloads/)
- The library will automatically detect OpenVPN in `Program Files` or `Program Files (x86)`

### macOS
```bash
# Using Homebrew
brew install openvpn

# Or download from https://openvpn.net/community-downloads/
```

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install openvpn

# CentOS/RHEL
sudo yum install openvpn

# Arch Linux
sudo pacman -S openvpn
```

## Quick Start

```typescript
import { OpenVpn } from 'openvpn-client'

// Create an instance with a config file
const openVpn = new OpenVpn('/path/to/config.ovpn', 'username', 'password')

// Listen for status changes
openVpn.on('status', (status) => {
  console.log('Status:', status)
})

// Listen for logs
openVpn.on('log', (log) => {
  console.log('Log:', log)
})

// Connect to VPN
try {
  await openVpn.connect()
  console.log('Connected to VPN!')
} catch (error) {
  console.error('Connection failed:', error)
}

// Disconnect
await openVpn.disconnect()
```

## Usage Examples

### Using Configuration File

```typescript
import { OpenVpn } from 'openvpn-client'

const openVpn = new OpenVpn(
  '/path/to/your/config.ovpn',
  'your_username',
  'your_password'
)

openVpn.on('status', (status) => {
  switch (status) {
    case 'connecting':
      console.log('Connecting to VPN...')
      break
    case 'connected':
      console.log('Successfully connected!')
      break
    case 'disconnected':
      console.log('Disconnected from VPN')
      break
    case 'error':
      console.log('Connection error occurred')
      break
  }
})

await openVpn.connect()
```

### Using Configuration String

```typescript
import { OpenVpn } from 'openvpn-client'

const configContent = `
client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-CBC
auth SHA256
key-direction 1
verb 3
<ca>
-----BEGIN CERTIFICATE-----
... your CA certificate ...
-----END CERTIFICATE-----
</ca>
<cert>
-----BEGIN CERTIFICATE-----
... your client certificate ...
-----END CERTIFICATE-----
</cert>
<key>
-----BEGIN PRIVATE KEY-----
... your private key ...
-----END PRIVATE KEY-----
</key>
`

const openVpn = OpenVpn.createFromConfig(
  configContent,
  'username',
  'password'
)

await openVpn.connect()
```

### Advanced Usage with Error Handling

```typescript
import { OpenVpn } from 'openvpn-client'

async function connectToVpn() {
  const openVpn = new OpenVpn('/path/to/config.ovpn', 'user', 'pass')
  
  // Set up event listeners
  openVpn.on('status', (status) => {
    console.log(`VPN Status: ${status}`)
  })
  
  openVpn.on('log', (log) => {
    console.log(`VPN Log: ${log}`)
  })
  
  try {
    await openVpn.connect()
    console.log('VPN connection established')
    
    // Do your work here...
    await someWork()
    
  } catch (error) {
    console.error('Failed to connect to VPN:', error)
  } finally {
    await openVpn.disconnect()
    console.log('VPN disconnected')
  }
}
```

## API Reference

### Constructor

```typescript
new OpenVpn(configPath, username, password)
```

- `configPath`: Path to the OpenVPN configuration file (.ovpn)
- `username`: Optional username for authentication
- `password`: Optional password for authentication

### Static Methods

#### `createFromConfig(config: string, username?: string, password?: string)`

Creates an OpenVpn instance from a configuration string instead of a file.

```typescript
const openVpn = OpenVpn.createFromConfig(configString, 'user', 'pass')
```

### Instance Methods

#### `connect(): Promise<void>`

Connects to the VPN server. Returns a promise that resolves when connected or rejects on error.

#### `disconnect(): Promise<void>`

Disconnects from the VPN server and cleans up resources.

#### `getProcesses(): Promise<Process[]>`

Returns a list of running OpenVPN processes.

#### `killProcesses(): Promise<void>`

Forcefully kills all OpenVPN processes.

### Events

The OpenVpn class extends EventEmitter and emits the following events:

#### `status` event

Emitted when the connection status changes. Possible status values:

- `'connecting'` - Attempting to connect
- `'connected'` - Successfully connected
- `'disconnected'` - Disconnected from VPN
- `'reconnecting'` - Reconnecting after connection loss
- `'stopped'` - Process stopped
- `'error'` - An error occurred
- `'auth'` - Authentication required
- `'auth_username'` - Username authentication requested
- `'auth_password'` - Password authentication requested
- `'auth_success'` - Authentication successful
- `'auth_failed'` - Authentication failed

#### `log` event

Emitted with OpenVPN log messages.

```typescript
openVpn.on('status', (status) => {
  console.log('Status changed to:', status)
})

openVpn.on('log', (message) => {
  console.log('OpenVPN:', message)
})
```

## Environment Variables

### `OPENVPN_BIN_PATH`

If OpenVPN is not found in the default locations, you can specify a custom path:

```bash
export OPENVPN_BIN_PATH=/custom/path/to/openvpn
```

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- OpenVPN installed on your system

### Setup

```bash
# Clone the repository
git clone https://github.com/ho3einwave/openvpn-client.git
cd openvpn-client

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Available Scripts

- `pnpm build` - Build the project
- `pnpm dev` - Build in watch mode
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm format` - Format code with Prettier

### Testing

To run tests, you'll need to set up environment variables:

```bash
# Create a .env file
OVPN_USERNAME=your_username
OVPN_PASSWORD=your_password
OVPN_CONFIG_PATH=/path/to/your/config.ovpn
```

Then run the tests:

```bash
pnpm test
```

## License

MIT © [ho3einwave](https://github.com/ho3einwave)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/ho3einwave/openvpn-client/issues) on GitHub.
