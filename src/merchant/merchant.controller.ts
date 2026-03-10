import { Controller, Get, UseGuards } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantGuard } from './guards/merchant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type JwtUser = { id: string; email?: string; role?: string };

@UseGuards(MerchantGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private svc: MerchantService) {}

  @Get('me')
  async getMyStore(@CurrentUser() user: JwtUser) {
    return this.svc.getMyStore(user.id);
  }
}
