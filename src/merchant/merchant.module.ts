import { Module } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { UploadService } from '../utils/upload.service';

@Module({
  imports: [PrismaModule, AuthModule, PaymentsModule, OrdersModule],
  providers: [MerchantService, UploadService],
  controllers: [MerchantController],
})
export class MerchantModule {}

