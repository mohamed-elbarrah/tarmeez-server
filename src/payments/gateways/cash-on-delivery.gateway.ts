import { Injectable } from '@nestjs/common'
import { BasePaymentGateway, PaymentContext, PaymentResult } from './base.gateway'

@Injectable()
export class CashOnDeliveryGateway extends BasePaymentGateway {
  readonly name = 'الدفع عند الاستلام'
  readonly key = 'cash_on_delivery'

  async processPayment(context: PaymentContext): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: `COD-${context.orderId}`,
    }
  }

  async refund(): Promise<PaymentResult> {
    return { success: true }
  }

  validateWebhook(): boolean {
    return true
  }
}
