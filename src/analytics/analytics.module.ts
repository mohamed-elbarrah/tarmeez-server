import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AnalyticsController } from './analytics.controller'
import { MerchantAnalyticsController } from './merchant-analytics.controller'
import { AnalyticsService } from './analytics.service'
import { AggregationService } from './aggregation.service'
import { GeoService } from './geo.service'
import { AnalyticsPrismaService } from './analytics-prisma.service'
import { AnalyticsQueryService } from './analytics-query.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [AnalyticsController, MerchantAnalyticsController],
  providers: [
    AnalyticsPrismaService,
    AnalyticsService,
    AggregationService,
    GeoService,
    AnalyticsQueryService,
  ],
  exports: [AnalyticsService, AnalyticsQueryService],
})
export class AnalyticsModule {}
