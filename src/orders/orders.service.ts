import { Injectable, BadRequestException, NotFoundException, HttpException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentRegistry } from '../payments/payment.registry'
import { CreateOrderDto } from './dto/create-order.dto'
import { generateUniqueOrderCode } from './utils/order-code.util'

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentRegistry,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    // 1. find store
    const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug } })
    if (!store) throw new NotFoundException('Store not found')

    // 2. verify payment method enabled
    if (!store.enabledPaymentMethods.includes(dto.paymentMethod)) {
      throw new BadRequestException('Payment method not enabled for this store')
    }

    // 3. validate items and compute subtotal
    let subtotal = 0
    const itemsData = [] as any[]

    for (const it of dto.items) {
      const product = await this.prisma.product.findUnique({ where: { id: it.productId } })
      if (!product || product.storeId !== store.id || product.status !== 'ACTIVE') {
        throw new BadRequestException(`Product ${it.productId} not available`)
      }
      if (product.trackStock && product.quantity < it.quantity) {
        throw new BadRequestException(`Product ${product.name} out of stock`)
      }
      const price = product.price
      const total = price * it.quantity
      subtotal += total
      itemsData.push({ product, quantity: it.quantity, total })
    }

    const shippingCost = 0
    const total = subtotal + shippingCost

    // 5. generate unique code
    const orderCode = await generateUniqueOrderCode(this.prisma as any)

    // 6. process payment
    const gateway = this.payments.get(dto.paymentMethod)
    const paymentResult = await gateway.processPayment({
      orderId: orderCode,
      amount: total,
      currency: 'SAR',
      customer: { name: dto.customerName, email: dto.customerEmail, phone: dto.customerPhone },
    })
    if (!paymentResult.success) {
      throw new HttpException(paymentResult.error || 'Payment failed', 402)
    }

    // 7. create order in transaction
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderCode,
          storeId: store.id,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          shippingAddress: dto.shippingAddress as any,
          paymentMethod: dto.paymentMethod,
          paymentStatus: paymentResult.success ? 'PAID' : 'PENDING',
          transactionId: paymentResult.transactionId,
          subtotal: subtotal as any,
          shippingCost: shippingCost as any,
          total: total as any,
          notes: dto.notes,
        },
      })

      for (const it of itemsData) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: it.product.id,
            productName: it.product.name,
            productImage: it.product.images && it.product.images.length ? it.product.images[0] : null,
            price: it.product.price as any,
            quantity: it.quantity,
            total: it.total as any,
          },
        })

        if (it.product.trackStock) {
          await tx.product.update({ where: { id: it.product.id }, data: { quantity: it.product.quantity - it.quantity } })
        }
      }

      return order
    })

    return {
      orderCode: created.orderCode,
      total: Number(created.total),
      status: created.status,
      paymentMethod: created.paymentMethod,
      estimatedDelivery: '3-5 أيام عمل',
    }
  }

  async getOrderByCode(orderCode: string, storeSlug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store) throw new NotFoundException('Store not found')

    const order = await this.prisma.order.findFirst({ where: { orderCode, storeId: store.id }, include: { items: true } })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }
}
