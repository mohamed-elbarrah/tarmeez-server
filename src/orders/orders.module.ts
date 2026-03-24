import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrdersController } from './orders.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { PaymentsModule } from '../payments/payments.module'
import { CouponsModule } from '../coupons/coupons.module'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [PrismaModule, PaymentsModule, CouponsModule, JwtModule.register({})],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
