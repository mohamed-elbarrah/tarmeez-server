import { Injectable, BadRequestException, NotFoundException, HttpException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentRegistry } from '../payments/payment.registry'
import { CouponsService } from '../coupons/coupons.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { generateUniqueOrderCode } from './utils/order-code.util'

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentRegistry,
    private couponsService: CouponsService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId?: string) {
    // 1. Find store by slug
    const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug } })
    if (!store) throw new NotFoundException('المتجر غير موجود')

    // 2. Dynamic field validation against merchant's checkoutFieldsConfig
    const rawConfig = store.checkoutFieldsConfig
    const fieldConfig: Array<{ id: string; label: string; enabled: boolean; required: boolean; isCustom: boolean }> =
      Array.isArray(rawConfig) && rawConfig.length > 0
        ? (rawConfig as any[])
        : [
            { id: 'name',    label: 'الاسم الكامل', enabled: true, required: true,  isCustom: false },
            { id: 'phone',   label: 'رقم الجوال',   enabled: true, required: true,  isCustom: false },
            { id: 'email',   label: 'البريد الإلكتروني', enabled: true, required: false, isCustom: false },
            { id: 'address', label: 'العنوان',        enabled: true, required: true,  isCustom: false },
          ]

    for (const field of fieldConfig) {
      if (!field.enabled || !field.required) continue
      switch (field.id) {
        case 'name':
          if (!dto.customerName?.trim())
            throw new BadRequestException(`${field.label} مطلوب`)
          break
        case 'phone':
          if (!dto.customerPhone?.trim())
            throw new BadRequestException(`${field.label} مطلوب`)
          break
        case 'email':
          if (!dto.customerEmail?.trim())
            throw new BadRequestException(`${field.label} مطلوب`)
          break
        case 'address':
          if (!dto.shippingAddress?.city?.trim() || !dto.shippingAddress?.region?.trim() || !dto.shippingAddress?.street?.trim())
            throw new BadRequestException(`${field.label} — يرجى إدخال المدينة والمنطقة والشارع`)
          break
        default:
          // Custom fields: value must appear in customFields map
          if (!dto.customFields?.[field.id]?.toString()?.trim())
            throw new BadRequestException(`${field.label} مطلوب`)
      }
    }

    // 3. Verify payment method is enabled for THIS store
    if (!store.enabledPaymentMethods.includes(dto.paymentMethod)) {
      throw new BadRequestException('طريقة الدفع غير متاحة في هذا المتجر')
    }

    // 3. If userId provided, find customer for THIS store
    let customerId: string | null = null
    if (userId) {
      const customer = await this.prisma.customer.findFirst({ where: { userId, storeId: store.id } })
      if (customer) customerId = customer.id
    }

    // 4. Validate products belong to THIS store and compute subtotal
    const orderItems: any[] = []
    let subtotal = 0

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({ where: { id: item.productId, storeId: store.id, status: 'ACTIVE' } })
      if (!product) {
        throw new BadRequestException(`المنتج ${item.productId} غير موجود`)
      }
      if (product.trackStock && product.quantity < item.quantity) {
        throw new BadRequestException(`المنتج ${product.name} غير متوفر بالكمية المطلوبة`)
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productImage: product.images && product.images.length ? product.images[0] : null,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
      })
    }

    const shippingCost = 0
    let couponDiscount = 0
    let couponValidation: any = null

    // Coupon validation
    if (dto.couponCode) {
      couponValidation = await this.couponsService.validate({
        code: dto.couponCode,
        storeId: store.id,
        orderTotal: subtotal,
        customerId: customerId ?? undefined,
        productIds: dto.items.map(i => i.productId),
      })

      if (!couponValidation.valid) {
        throw new BadRequestException(couponValidation.message)
      }

      couponDiscount = couponValidation.discount
    }

    const total = subtotal + shippingCost - couponDiscount

    // 5. Generate unique order code
    const orderCode = await generateUniqueOrderCode(this.prisma as any)

    // 6. Process payment
    const gateway = this.payments.get(dto.paymentMethod)
    const paymentResult = await gateway.processPayment({
      orderId: orderCode,
      amount: total,
      currency: 'SAR',
      customer: {
        name: dto.customerName,
        phone: dto.customerPhone,
        email: dto.customerEmail,
      },
    })

    if (!paymentResult.success) {
      throw new HttpException('فشلت عملية الدفع', 402)
    }

    // 7. Create order + items + update stock in ONE transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderCode,
          storeId: store.id,
          customerId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail,
          shippingCity: dto.shippingAddress?.city ?? null,
          shippingRegion: dto.shippingAddress?.region ?? null,
          shippingStreet: dto.shippingAddress?.street ?? null,
          shippingBuilding: dto.shippingAddress?.building ?? null,
          paymentMethod: dto.paymentMethod,
          paymentStatus: 'PENDING',
          transactionId: paymentResult.transactionId,
          subtotal: subtotal as any,
          shippingCost: shippingCost as any,
          total: total as any,
          couponCode: dto.couponCode ?? null,
          couponDiscount: couponDiscount,
          notes: dto.notes,
          customFields: dto.customFields || undefined,
          status: 'PENDING',
          items: {
            create: orderItems
          }
        },
        include: { items: true }
      })

      // Decrement stock for tracked products
      for (const item of dto.items) {
        await tx.product.updateMany({
          where: { id: item.productId, trackStock: true },
          data: { quantity: { decrement: item.quantity } }
        })
      }

      return newOrder
    }) as any

    // Record coupon usage after transaction succeeds
    if (dto.couponCode && couponValidation?.valid && couponValidation.couponId) {
      await this.couponsService.recordUsage(
        couponValidation.couponId,
        order.id,
        customerId,
        couponDiscount,
      )
    }

    return order
  }

  async getOrderByCode(orderCode: string, storeSlug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store) throw new NotFoundException('Store not found')

    const order = await this.prisma.order.findFirst({ where: { orderCode, storeId: store.id }, include: { items: true } })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }
}
