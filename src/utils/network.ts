import { networkInterfaces } from 'systeminformation'

export const detectVPNViaNetworkInterfaces = async (): Promise<boolean> => {
  const interfaces = await networkInterfaces()

  // console.log(interfaces)

  const suspiciousInterfaces = [
    'tun',
    'tap',
    'ppp',
    'vpn',
    'nord',
    'express',
    'surfshark',
    'cyberghost',
    'tunnel',
    'openvpn',
    'wireguard',
  ]

  const hasSuspiciousInterfaces = interfaces.some(
    (iface) =>
      iface.operstate === 'up' &&
      suspiciousInterfaces.some((susName) =>
        iface.ifaceName.toLowerCase().includes(susName.toLowerCase()),
      ),
  )

  return hasSuspiciousInterfaces
}

export const isAnyOpenVpnInterfaceUp = async () => {
  const interfaces = await networkInterfaces()

  return interfaces.some(
    (iface) =>
      iface.operstate === 'up' &&
      iface.ifaceName.toLowerCase().includes('openvpn'),
  )
}
