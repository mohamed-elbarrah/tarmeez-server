import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
import { MailModule } from './mail/mail.module';
import { TeamModule } from './team/team.module';
import { LandingPageModule } from './landing-page/landing-page.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    MailModule,
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
    TeamModule,
    LandingPageModule,
    ThrottlerModule.forRoot({ ttl: 60, limit: 5 }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
