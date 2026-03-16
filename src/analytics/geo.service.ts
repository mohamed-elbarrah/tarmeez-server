import { Injectable } from '@nestjs/common'
import * as geoip from 'geoip-country'

@Injectable()
export class GeoService {
  lookup(ip: string): { country: string | null } {
    try {
      if (!ip || ip === '::1' || ip === '127.0.0.1') {
        return { country: null }
      }
      // Handle IPv4-mapped IPv6 (::ffff:x.x.x.x)
      const cleanIp = ip.replace(/^::ffff:/, '')
      const geo = geoip.lookup(cleanIp)
      return { country: geo?.country ?? null }
    } catch {
      return { country: null }
    }
    // IP is never stored — only country code returned
  }
}
