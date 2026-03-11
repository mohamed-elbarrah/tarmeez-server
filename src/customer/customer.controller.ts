import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CustomerGuard } from '../auth/guards/customer.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomerService } from './customer.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

type JwtUser = { id: string; storeId?: string; role?: string };

@UseGuards(CustomerGuard)
@Controller()
export class CustomerController {
  constructor(private svc: CustomerService) {}

  @Get('auth/customer/me')
  async getMe(@CurrentUser() user: JwtUser) {
    return this.svc.getMe(user);
  }

  @Patch('auth/customer/profile')
  async updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(user, dto);
  }

  /* Addresses */
  @Get('customer/addresses')
  async getAddresses(@CurrentUser() user: JwtUser) {
    return this.svc.getAddresses(user);
  }

  @Post('customer/addresses')
  async createAddress(@CurrentUser() user: JwtUser, @Body() dto: CreateAddressDto) {
    return this.svc.createAddress(user, dto);
  }

  @Patch('customer/addresses/:id')
  async updateAddress(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.svc.updateAddress(user, id, dto);
  }

  @Delete('customer/addresses/:id')
  async deleteAddress(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deleteAddress(user, id);
  }

  /* Payment Methods */
  @Get('customer/payment-methods')
  async getPaymentMethods(@CurrentUser() user: JwtUser) {
    return this.svc.getPaymentMethods(user);
  }

  @Post('customer/payment-methods')
  async createPaymentMethod(@CurrentUser() user: JwtUser, @Body() dto: CreatePaymentMethodDto) {
    return this.svc.createPaymentMethod(user, dto);
  }

  @Patch('customer/payment-methods/:id/default')
  async setDefaultPayment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.setDefaultPayment(user, id);
  }

  @Delete('customer/payment-methods/:id')
  async deletePaymentMethod(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.deletePaymentMethod(user, id);
  }

  /* Orders (read-only placeholder) */
  @Get('customer/orders')
  async getOrders(@CurrentUser() user: JwtUser) {
    return this.svc.getOrders(user);
  }
}
