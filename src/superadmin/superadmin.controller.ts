import { Controller, Get, Query, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { SuperadminGuard } from './guards/superadmin.guard';
import { MerchantStatus } from '@prisma/client';

@UseGuards(SuperadminGuard)
@Controller('superadmin')
export class SuperadminController {
  constructor(private svc: SuperadminService) {}

  @Get('merchants')
  async getMerchants(@Query('status') status?: MerchantStatus) {
    return this.svc.getMerchants(status as MerchantStatus | undefined);
  }

  @Get('merchants/:id')
  async getMerchantById(@Param('id') id: string) {
    return this.svc.getMerchantById(id);
  }

  @Patch('merchants/:id/approve')
  async approveMerchant(@Param('id') id: string) {
    const { merchant, store } = await this.svc.approveMerchant(id);
    return {
      message: 'Merchant approved successfully',
      merchant,
      store,
    };
  }

  @Patch('merchants/:id/reject')
  async rejectMerchant(@Param('id') id: string, @Body('reason') _reason?: string) {
    const merchant = await this.svc.rejectMerchant(id);
    return {
      message: 'Merchant rejected',
      merchant,
    };
  }
}
