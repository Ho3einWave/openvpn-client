import { describe, expect, it } from 'vitest'
import {
  detectVPNViaNetworkInterfaces,
  isAnyOpenVpnInterfaceUp,
} from '../../src/index'
describe('Network utilities test', () => {
  it('it should detect any vpn network interface', async () => {
    const isUsingVPN = await detectVPNViaNetworkInterfaces()
    expect(isUsingVPN).toBe(true)
  })
  it('should detect any openvpn interface', async () => {
    const isAnyOpenVPN = await isAnyOpenVpnInterfaceUp()
    expect(isAnyOpenVPN).toBe(true)
  })
})
