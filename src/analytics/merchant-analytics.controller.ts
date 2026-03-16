import {
  Controller,
  Get,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { MerchantGuard } from '../merchant/guards/merchant.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AnalyticsQueryService } from './analytics-query.service'
import { PrismaService } from '../prisma/prisma.service'

type JwtUser = { id: string; email?: string; role?: string }

@UseGuards(MerchantGuard)
@Controller('merchant/analytics')
export class MerchantAnalyticsController {
  constructor(
    private analyticsQueryService: AnalyticsQueryService,
    private prisma: PrismaService,
  ) {}

  /** Resolve merchant's storeId from JWT userId — queries regular PrismaService (ANALYTICS-RULE 1) */
  private async getStoreId(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: { select: { id: true } } },
    })
    if (!merchant?.store) throw new NotFoundException('Store not found')
    return merchant.store.id
  }

  @Get('overview')
  async getOverview(
    @CurrentUser() user: JwtUser,
    @Query('period') period = '7d',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getOverview(storeId, period)
  }

  @Get('traffic')
  async getTraffic(
    @CurrentUser() user: JwtUser,
    @Query('period') period = '7d',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getTraffic(storeId, period)
  }

  @Get('pages')
  async getPages(
    @CurrentUser() user: JwtUser,
    @Query('period') period = '7d',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getPages(storeId, period)
  }

  @Get('funnel')
  async getFunnel(
    @CurrentUser() user: JwtUser,
    @Query('period') period = '7d',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getFunnel(storeId, period)
  }

  @Get('sales')
  async getSales(
    @CurrentUser() user: JwtUser,
    @Query('period') period = '30d',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getSales(storeId, period)
  }

  @Get('heatmap')
  async getHeatmap(
    @CurrentUser() user: JwtUser,
    @Query('page') page = '/',
    @Query('type') type = 'CLICK',
    @Query('device') device = 'DESKTOP',
  ) {
    const storeId = await this.getStoreId(user.id)
    return this.analyticsQueryService.getHeatmap(
      storeId,
      page,
      type.toUpperCase(),
      device.toUpperCase(),
    )
  }
}
