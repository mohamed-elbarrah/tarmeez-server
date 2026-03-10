import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantGuard } from './guards/merchant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateStoreDto } from './dto/update-store.dto';

type JwtUser = { id: string; email?: string; role?: string };

@UseGuards(MerchantGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private svc: MerchantService) { }

  @Get('me')
  async getMyStore(@CurrentUser() user: JwtUser) {
    return this.svc.getMyStore(user.id);
  }

  @Patch('store/customization')
  async updateStoreCustomization(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.svc.updateStoreCustomization(user.id, dto);
  }
}
