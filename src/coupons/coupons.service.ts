import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCouponDto, CouponType } from './dto/create-coupon.dto'
import { ValidateCouponDto } from './dto/validate-coupon.dto'
import { randomBytes } from 'crypto'

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  /* ─── helpers ─── */
  private async getStoreId(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    })
    if (!merchant || !merchant.store)
      throw new NotFoundException('المتجر غير موجود')
    return merchant.store.id
  }

  /* ─── CRUD ─── */

  async create(userId: string, dto: CreateCouponDto) {
    const storeId = await this.getStoreId(userId)

    // Validate type-specific requirements
    if (dto.type === CouponType.PERCENTAGE) {
      if (dto.discountValue == null || dto.discountValue < 0 || dto.discountValue > 100)
        throw new BadRequestException('قيمة الخصم يجب أن تكون بين 0 و 100')
    }

    if (dto.type === CouponType.FIXED_AMOUNT) {
      if (dto.discountValue == null || dto.discountValue <= 0)
        throw new BadRequestException('قيمة الخصم مطلوبة')
    }

    if (dto.type === CouponType.FREE_PRODUCT) {
      if (!dto.freeProductId)
        throw new BadRequestException('يجب تحديد المنتج المجاني')
    }

    if (dto.type === CouponType.PRODUCT_DISCOUNT) {
      if (dto.discountValue == null || dto.discountValue <= 0)
        throw new BadRequestException('قيمة الخصم مطلوبة')
      if ((!dto.applicableProductIds || dto.applicableProductIds.length === 0) &&
          (!dto.applicableCategoryIds || dto.applicableCategoryIds.length === 0))
        throw new BadRequestException('يجب تحديد منتجات أو تصنيفات محددة')
    }

    // Check code uniqueness within store
    const existing = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: dto.code } },
    })
    if (existing) throw new BadRequestException('كود الكوبون مستخدم بالفعل')

    return this.prisma.coupon.create({
      data: {
        storeId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type as any,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount,
        freeProductId: dto.freeProductId,
        freeProductQty: dto.freeProductQty ?? 1,
        applicableProductIds: dto.applicableProductIds ?? [],
        applicableCategoryIds: dto.applicableCategoryIds ?? [],
        minOrderAmount: dto.minOrderAmount,
        maxUsageCount: dto.maxUsageCount,
        perCustomerLimit: dto.perCustomerLimit ?? 1,
        customerIds: dto.customerIds ?? [],
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    })
  }

  async findAll(userId: string, query: { status?: string; page?: number; limit?: number }) {
    const storeId = await this.getStoreId(userId)
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? query.limit : 20
    const skip = (page - 1) * limit

    const where: any = { storeId }
    if (query.status && query.status !== 'all') where.status = query.status

    const [total, coupons] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { usages: true } },
          freeProduct: { select: { id: true, name: true, images: true } },
        },
      }),
    ])

    // Compute stats
    const stats = await this.prisma.coupon.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true,
    })
    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count
      return acc
    }, {} as Record<string, number>)

    // Total discount given
    const totalDiscountResult = await this.prisma.couponUsage.aggregate({
      where: { coupon: { storeId } },
      _sum: { discountAmount: true },
    })

    const totalUsagesResult = await this.prisma.couponUsage.count({
      where: { coupon: { storeId } },
    })

    return {
      total,
      page,
      limit,
      coupons,
      stats: {
        active: statsMap['ACTIVE'] ?? 0,
        inactive: statsMap['INACTIVE'] ?? 0,
        expired: statsMap['EXPIRED'] ?? 0,
        depleted: statsMap['DEPLETED'] ?? 0,
        totalUsages: totalUsagesResult,
        totalDiscount: totalDiscountResult._sum.discountAmount ?? 0,
      },
    }
  }

  async findOne(userId: string, couponId: string) {
    const storeId = await this.getStoreId(userId)
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
      include: {
        usages: { take: 20, orderBy: { usedAt: 'desc' } },
        freeProduct: { select: { id: true, name: true, images: true } },
      },
    })
    if (!coupon) throw new NotFoundException('الكوبون غير موجود')
    return coupon
  }

  async update(userId: string, couponId: string, dto: Partial<CreateCouponDto>) {
    const storeId = await this.getStoreId(userId)
    const coupon = await this.prisma.coupon.findFirst({ where: { id: couponId, storeId } })
    if (!coupon) throw new NotFoundException('الكوبون غير موجود')

    // Cannot change type after creation
    if (dto.type && dto.type !== coupon.type)
      throw new BadRequestException('لا يمكن تغيير نوع الكوبون بعد إنشائه')

    // If code is changed, check uniqueness
    if (dto.code && dto.code !== coupon.code) {
      const existing = await this.prisma.coupon.findUnique({
        where: { storeId_code: { storeId, code: dto.code } },
      })
      if (existing) throw new BadRequestException('كود الكوبون مستخدم بالفعل')
    }

    const data: any = { ...dto }
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt)
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt)
    delete data.type // Cannot change type

    return this.prisma.coupon.update({ where: { id: couponId }, data })
  }

  async remove(userId: string, couponId: string) {
    const storeId = await this.getStoreId(userId)
    const coupon = await this.prisma.coupon.findFirst({ where: { id: couponId, storeId } })
    if (!coupon) throw new NotFoundException('الكوبون غير موجود')

    if (coupon.usageCount > 0) {
      // Deactivate instead of delete
      return this.prisma.coupon.update({
        where: { id: couponId },
        data: { status: 'INACTIVE' as any },
      })
    }

    return this.prisma.coupon.delete({ where: { id: couponId } })
  }

  async toggleStatus(userId: string, couponId: string) {
    const storeId = await this.getStoreId(userId)
    const coupon = await this.prisma.coupon.findFirst({ where: { id: couponId, storeId } })
    if (!coupon) throw new NotFoundException('الكوبون غير موجود')

    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { status: newStatus as any },
    })
  }

  /* ─── VALIDATE (public, used by storefront checkout) ─── */

  async validate(dto: ValidateCouponDto): Promise<{
    valid: boolean
    discount: number
    freeProduct?: { id: string; name: string; qty: number }
    message?: string
    couponId?: string
  }> {
    const fail = (message: string) => ({ valid: false, discount: 0, message })

    // Resolve storeId from storeSlug if needed
    let storeId = dto.storeId
    if (!storeId && dto.storeSlug) {
      const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug } })
      if (!store) return fail('معرّف المتجر غير صالح')
      storeId = store.id
    }

    if (!storeId) return fail('معرّف المتجر غير متاح')

    // 1. Coupon exists for this store
    const coupon = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: dto.code.toUpperCase().trim() } },
      include: { freeProduct: { select: { id: true, name: true } } },
    })
    if (!coupon) return fail('كود الخصم غير صالح')

    // 2. Status check
    if (coupon.status !== 'ACTIVE') return fail('كود الخصم غير نشط')

    // 3. Expiry check
    if (coupon.expiresAt && new Date() > coupon.expiresAt)
      return fail('كود الخصم منتهي الصلاحية')

    // 4. Start date check
    if (coupon.startsAt && new Date() < coupon.startsAt)
      return fail('كود الخصم لم يبدأ بعد')

    // 5. Usage count
    if (coupon.maxUsageCount && coupon.usageCount >= coupon.maxUsageCount)
      return fail('تم استنفاد عدد مرات استخدام الكوبون')

    // 6. Minimum order amount
    if (coupon.minOrderAmount && dto.orderTotal < coupon.minOrderAmount)
      return fail(`الحد الأدنى للطلب ${coupon.minOrderAmount} ر.س`)

    // 7. Customer-specific restriction
    if (coupon.customerIds.length > 0 && dto.customerId) {
      if (!coupon.customerIds.includes(dto.customerId))
        return fail('هذا الكوبون غير متاح لك')
    }

    // 8. Per customer limit
    if (dto.customerId && coupon.perCustomerLimit) {
      const customerUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, customerId: dto.customerId },
      })
      if (customerUsages >= coupon.perCustomerLimit)
        return fail('لقد تجاوزت الحد المسموح لاستخدام هذا الكوبون')
    }

    // 9. Product-specific check
    if (coupon.type === 'PRODUCT_DISCOUNT' && dto.productIds) {
      const hasEligible = dto.productIds.some(pid =>
        coupon.applicableProductIds.includes(pid),
      )
      if (!hasEligible)
        return fail('لا توجد منتجات مؤهلة لهذا الكوبون في سلتك')
    }

    // Calculate discount
    let discount = 0

    switch (coupon.type) {
      case 'PERCENTAGE':
        discount = dto.orderTotal * ((coupon.discountValue ?? 0) / 100)
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount)
          discount = coupon.maxDiscountAmount
        break

      case 'FIXED_AMOUNT':
        discount = Math.min(coupon.discountValue ?? 0, dto.orderTotal)
        break

      case 'FREE_SHIPPING':
        discount = 0 // handled in checkout by removing shipping cost
        break

      case 'FREE_PRODUCT':
        discount = 0
        return {
          valid: true,
          discount: 0,
          couponId: coupon.id,
          freeProduct: coupon.freeProduct
            ? { id: coupon.freeProduct.id, name: coupon.freeProduct.name, qty: coupon.freeProductQty ?? 1 }
            : undefined,
          message: 'تم تطبيق الكوبون — ستحصل على منتج مجاني',
        }

      case 'PRODUCT_DISCOUNT':
        discount = dto.orderTotal * ((coupon.discountValue ?? 0) / 100)
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount)
          discount = coupon.maxDiscountAmount
        break
    }

    discount = Math.round(discount * 100) / 100

    const typeMessages: Record<string, string> = {
      PERCENTAGE: `خصم ${coupon.discountValue}% — وفرت ${discount} ر.س`,
      FIXED_AMOUNT: `خصم ${discount} ر.س`,
      FREE_SHIPPING: 'شحن مجاني',
      PRODUCT_DISCOUNT: `خصم ${coupon.discountValue}% على المنتجات المحددة — وفرت ${discount} ر.س`,
    }

    return {
      valid: true,
      discount,
      couponId: coupon.id,
      message: typeMessages[coupon.type] ?? 'تم تطبيق الكوبون',
    }
  }

  /* ─── CODE GENERATION ─── */

  async generateCode(prefix?: string): Promise<string> {
    const pfx = prefix?.toUpperCase() || 'TARMEEZ'
    const rand = () => randomBytes(2).toString('hex').toUpperCase()
    let code: string
    let exists = true
    let attempts = 0

    while (exists && attempts < 10) {
      code = `${pfx}-${rand()}-${rand()}`
      const found = await this.prisma.coupon.findFirst({ where: { code: code! } })
      exists = !!found
      attempts++
    }

    return code!
  }

  /* ─── RECORD USAGE (called after order is created) ─── */

  async recordUsage(
    couponId: string,
    orderId: string,
    customerId: string | null,
    discountAmount: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.couponUsage.create({
        data: {
          couponId,
          orderId,
          customerId,
          discountAmount,
        },
      })

      const coupon = await tx.coupon.update({
        where: { id: couponId },
        data: { usageCount: { increment: 1 } },
      })

      // Check if depleted
      if (coupon.maxUsageCount && coupon.usageCount >= coupon.maxUsageCount) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { status: 'DEPLETED' as any },
        })
      }
    })
  }
}
