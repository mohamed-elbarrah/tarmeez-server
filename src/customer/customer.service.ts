import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  private async findCustomerByUser(userId: string, storeId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId_storeId: { userId, storeId } as any } as any });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getMe(user: any) {
    const customer = await this.prisma.customer.findUnique({ where: { userId_storeId: { userId: user.id, storeId: user.storeId } as any } as any, include: { user: true } });
    if (!customer) throw new NotFoundException('Customer not found');

    return {
      id: customer.id,
      fullName: customer.fullName,
      email: (customer.user as any)?.email ?? null,
      phone: customer.phone,
      createdAt: customer.createdAt,
    };
  }

  async updateProfile(user: any, dto: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const updated = await this.prisma.customer.update({ where: { id: customer.id }, data: { fullName: dto.fullName ?? customer.fullName, phone: dto.phone ?? customer.phone } as any });
    return { id: updated.id, fullName: updated.fullName, phone: updated.phone, createdAt: updated.createdAt };
  }

  /* Addresses */
  async getAddresses(user: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const addresses = await this.prisma.address.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } });
    return addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, city: a.city, region: a.region, street: a.street, buildingNo: a.buildingNo, isDefault: a.isDefault }));
  }

  async createAddress(user: any, dto: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } as any });
    }
    const created = await this.prisma.address.create({ data: { customerId: customer.id, fullName: dto.fullName, phone: dto.phone, city: dto.city, region: dto.region, street: dto.street, buildingNo: dto.buildingNo ?? null, isDefault: dto.isDefault ?? false } as any });
    return created;
  }

  async updateAddress(user: any, id: string, dto: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const existing = await this.prisma.address.findUnique({ where: { id } as any });
    if (!existing || existing.customerId !== customer.id) throw new ForbiddenException('Access denied');
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } as any });
    }
    const updated = await this.prisma.address.update({ where: { id } as any, data: { fullName: dto.fullName ?? existing.fullName, phone: dto.phone ?? existing.phone, city: dto.city ?? existing.city, region: dto.region ?? existing.region, street: dto.street ?? existing.street, buildingNo: dto.buildingNo ?? existing.buildingNo, isDefault: dto.isDefault ?? existing.isDefault } as any });
    return updated;
  }

  async deleteAddress(user: any, id: string) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const existing = await this.prisma.address.findUnique({ where: { id } as any });
    if (!existing || existing.customerId !== customer.id) throw new ForbiddenException('Access denied');
    await this.prisma.address.delete({ where: { id } as any });
    return { message: 'تم حذف العنوان بنجاح' };
  }

  /* Payment Methods */
  async getPaymentMethods(user: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const methods = await this.prisma.paymentMethod.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } });
    return methods.map((m) => ({ id: m.id, type: m.type, last4: m.last4, expiryMonth: m.expiryMonth, expiryYear: m.expiryYear, holderName: m.holderName, isDefault: m.isDefault }));
  }

  async createPaymentMethod(user: any, dto: any) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    if (dto.isDefault) {
      await this.prisma.paymentMethod.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } as any });
    }
    const created = await this.prisma.paymentMethod.create({ data: { customerId: customer.id, type: dto.type, last4: dto.last4, expiryMonth: dto.expiryMonth, expiryYear: dto.expiryYear, holderName: dto.holderName, isDefault: dto.isDefault ?? false } as any });
    return created;
  }

  async setDefaultPayment(user: any, id: string) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } as any });
    if (!existing || existing.customerId !== customer.id) throw new ForbiddenException('Access denied');
    await this.prisma.paymentMethod.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } as any });
    const updated = await this.prisma.paymentMethod.update({ where: { id } as any, data: { isDefault: true } as any });
    return updated;
  }

  async deletePaymentMethod(user: any, id: string) {
    const customer = await this.findCustomerByUser(user.id, user.storeId);
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } as any });
    if (!existing || existing.customerId !== customer.id) throw new ForbiddenException('Access denied');
    await this.prisma.paymentMethod.delete({ where: { id } as any });
    return { message: 'تم حذف طريقة الدفع بنجاح' };
  }

  async getOrders(user: any) {
    // Orders module not implemented yet
    return [];
  }
}
