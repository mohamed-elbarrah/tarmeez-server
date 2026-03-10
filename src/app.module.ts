import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { MerchantModule } from './merchant/merchant.module';
import { ProductsModule } from './products/products.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SuperadminModule,
    MerchantModule,
    ProductsModule,
    StoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

