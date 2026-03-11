import { Module, OnModuleInit } from '@nestjs/common'
import { CashOnDeliveryGateway } from './gateways/cash-on-delivery.gateway'
import { PaymentRegistry } from './payment.registry'

@Module({
  providers: [PaymentRegistry, CashOnDeliveryGateway],
  exports: [PaymentRegistry, CashOnDeliveryGateway],
})
export class PaymentsModule implements OnModuleInit {
  constructor(
    private registry: PaymentRegistry,
    private cod: CashOnDeliveryGateway,
  ) {}

  onModuleInit() {
    this.registry.register(this.cod)
  }
}
