import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { MerchantGuard } from '../merchant/guards/merchant.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AnalyticsQueryService } from './analytics-query.service'
import { Action } from '../common/enums/action.enum'
import { Resource } from '../common/enums/resource.enum'
import { Permissions } from '../common/decorators/permissions.decorator'

type JwtUser = { id: string; email?: string; role?: string }

@UseGuards(MerchantGuard)
@Controller('merchant/analytics')
export class MerchantAnalyticsController {
  constructor(
    private analyticsQueryService: AnalyticsQueryService,
  ) {}

  @Get('overview')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getOverview(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('period') period = '7d',
  ) {
    return this.analyticsQueryService.getOverview(req.activeStore.id, period)
  }

  @Get('traffic')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getTraffic(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('period') period = '7d',
  ) {
    return this.analyticsQueryService.getTraffic(req.activeStore.id, period)
  }

  @Get('pages')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getPages(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('period') period = '7d',
  ) {
    return this.analyticsQueryService.getPages(req.activeStore.id, period)
  }

  @Get('funnel')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getFunnel(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('period') period = '7d',
  ) {
    return this.analyticsQueryService.getFunnel(req.activeStore.id, period)
  }

  @Get('sales')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getSales(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('period') period = '30d',
  ) {
    return this.analyticsQueryService.getSales(req.activeStore.id, period)
  }

  @Get('heatmap')
  @Permissions(Resource.ANALYTICS, Action.READ)
  async getHeatmap(
    @CurrentUser() user: JwtUser,
    @Req() req: any,
    @Query('page') page = '/',
    @Query('type') type = 'CLICK',
    @Query('device') device = 'DESKTOP',
  ) {
    return this.analyticsQueryService.getHeatmap(
      req.activeStore.id,
      page,
      type.toUpperCase(),
      device.toUpperCase(),
    )
  }
}

