import { Injectable, NotFoundException } from '@nestjs/common'
import { BasePaymentGateway } from './gateways/base.gateway'

@Injectable()
export class PaymentRegistry {
  private gateways = new Map<string, BasePaymentGateway>()

  register(gateway: BasePaymentGateway) {
    this.gateways.set(gateway.key, gateway)
  }

  get(key: string): BasePaymentGateway {
    const gateway = this.gateways.get(key)
    if (!gateway) throw new NotFoundException(`Payment gateway ${key} not found`)
    return gateway
  }

  getAll(): BasePaymentGateway[] {
    return Array.from(this.gateways.values())
  }
}
