import { Module } from '@nestjs/common'
import { CouponsService } from './coupons.service'
import { MerchantCouponsController, PublicCouponsController } from './coupons.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [CouponsService],
  controllers: [MerchantCouponsController, PublicCouponsController],
  exports: [CouponsService],
})
export class CouponsModule {}
