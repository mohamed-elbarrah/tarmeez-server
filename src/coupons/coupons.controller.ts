import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common'
import { CouponsService } from './coupons.service'
import { CreateCouponDto } from './dto/create-coupon.dto'
import { ValidateCouponDto } from './dto/validate-coupon.dto'
import { MerchantGuard } from '../merchant/guards/merchant.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ThrottlerGuard } from '@nestjs/throttler'

type JwtUser = { id: string; email?: string; role?: string }

/* ═══ Merchant endpoints (protected) ═══ */

@UseGuards(MerchantGuard)
@Controller('merchant/coupons')
export class MerchantCouponsController {
  constructor(private svc: CouponsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.findAll(user.id, {
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    })
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCouponDto) {
    return this.svc.create(user.id, dto)
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.findOne(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCouponDto>,
  ) {
    return this.svc.update(user.id, id, dto)
  }

  @Patch(':id/toggle')
  toggle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggleStatus(user.id, id)
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.id, id)
  }

  @Post('generate-code')
  generateCode(@Body() body: { prefix?: string }) {
    return this.svc.generateCode(body.prefix).then(code => ({ code }))
  }
}

/* ═══ Public endpoint (for storefront checkout) ═══ */

@Controller('coupons')
export class PublicCouponsController {
  constructor(private svc: CouponsService) {}

  @UseGuards(ThrottlerGuard)
  @Post('validate')
  validate(@Body() dto: ValidateCouponDto) {
    return this.svc.validate(dto)
  }
}
