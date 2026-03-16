import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { AggregationService } from './aggregation.service'
import { GeoService } from './geo.service'
import { AnalyticsPrismaService } from './analytics-prisma.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsPrismaService,
    AnalyticsService,
    AggregationService,
    GeoService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
