import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
  OnModuleDestroy,
  ForbiddenException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AnalyticsService } from './analytics.service'
import { AggregationService } from './aggregation.service'
import { GeoService } from './geo.service'
import { CollectEventDto } from './dto/collect-event.dto'

@Controller('analytics')
export class AnalyticsController implements OnModuleDestroy {
  private buffer: any[] = []
  private flushTimer: NodeJS.Timeout

  constructor(
    private analyticsService: AnalyticsService,
    private aggregationService: AggregationService,
    private geoService: GeoService,
  ) {
    // Flush buffer every 10 seconds (ANALYTICS-RULE 3)
    this.flushTimer = setInterval(() => this.flush(), 10000)
  }

  onModuleDestroy() {
    clearInterval(this.flushTimer)
    // Final flush on shutdown
    this.flush()
  }

  @Post('collect')
  @HttpCode(200)
  @Throttle(100, 60)
  async collect(
    @Body() dto: CollectEventDto,
    @Req() req: any,
  ) {
    // Resolve storeRef (UUID or slug) to actual storeId (ANALYTICS-RULE 6)
    const storeId = await this.analyticsService.resolveStore(dto.storeRef)
    if (!storeId) return { ok: false }

    // Derive country from IP — IP is never stored (ANALYTICS-RULE 2)
    const forwarded = req.headers['x-forwarded-for']
    const ip = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip
    ) as string

    const { country } = this.geoService.lookup(ip)
    // ip variable goes out of scope here — not stored

    // Buffer event with resolved storeId — return immediately, no await (ANALYTICS-RULE 3)
    this.buffer.push({ ...dto, storeId, country })

    return { ok: true }
  }

  @Post('trigger-aggregation')
  @HttpCode(200)
  async triggerAggregation() {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException()
    }
    await this.aggregationService.aggregateHourly()
    await this.aggregationService.aggregateDaily()
    return { ok: true, message: 'Aggregation triggered' }
  }

  private async flush() {
    if (this.buffer.length === 0) return
    const batch = [...this.buffer]
    this.buffer = []
    try {
      await this.analyticsService.processBatch(batch)
    } catch (err) {
      // Log but never crash (ANALYTICS-RULE 11)
      console.error('Analytics flush error:', err)
    }
  }
}
