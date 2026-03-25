import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { CustomerModule } from './customer/customer.module';
import { MerchantModule } from './merchant/merchant.module';
import { ProductsModule } from './products/products.module';
import { StoresModule } from './stores/stores.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoriesModule } from './categories/categories.module';
import { PagesModule } from './pages/pages.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { CouponsModule } from './coupons/coupons.module';
import { ThemesModule } from './themes/themes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CustomerModule,
    SuperadminModule,
    MerchantModule,
    ProductsModule,
    StoresModule,
    PaymentsModule,
    OrdersModule,
    ReviewsModule,
    CategoriesModule,
    PagesModule,
    AnalyticsModule,
    CouponsModule,
    ThemesModule,
    ThrottlerModule.forRoot({ ttl: 60, limit: 5 }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
