import { NotFoundException } from '@nestjs/common'

export interface PaymentResult {
  success: boolean
  transactionId?: string
  error?: string
}

export interface PaymentContext {
  orderId: string
  amount: number
  currency: string
  customer: {
    name: string
    email?: string
    phone: string
  }
}

export abstract class BasePaymentGateway {
  abstract readonly name: string
  abstract readonly key: string

  abstract processPayment(context: PaymentContext): Promise<PaymentResult>
  abstract refund(transactionId: string, amount: number): Promise<PaymentResult>
  abstract validateWebhook(payload: any, signature: string): boolean
}
