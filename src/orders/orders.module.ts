import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrdersController } from './orders.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { PaymentsModule } from '../payments/payments.module'

@Module({
  imports: [PrismaModule, PaymentsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
