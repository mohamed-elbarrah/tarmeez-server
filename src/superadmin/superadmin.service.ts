import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantStatus, Prisma } from '@prisma/client';

@Injectable()
export class SuperadminService {
  constructor(private prisma: PrismaService) {}

  async getMerchants(status?: MerchantStatus) {
    const where = status ? { status } : undefined;

    return this.prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        storeName: true,
        storeSlug: true,
        category: true,
        country: true,
        city: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
  }

  async getMerchantById(id: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: { user: { select: { email: true } }, store: true },
    });

    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  async approveMerchant(id: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.status !== MerchantStatus.PENDING) {
      throw new BadRequestException('Merchant is not pending approval');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.merchant.update({
          where: { id },
          data: { status: MerchantStatus.ACTIVE },
        });

        const store = await tx.store.create({
          data: {
            merchantId: updated.id,
            slug: updated.storeSlug,
            name: updated.storeName,
            isOnboarded: false,
          },
        });

        return { merchant: updated, store };
      });

      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Store already exists');
      }
      throw err;
    }
  }

  async rejectMerchant(id: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.status !== MerchantStatus.PENDING) {
      throw new BadRequestException('Merchant is not pending');
    }

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: { status: MerchantStatus.REJECTED },
    });

    return updated;
  }
}
