import { Injectable } from '@nestjs/common'
import { AnalyticsPrismaService } from './analytics-prisma.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AnalyticsQueryService {
  constructor(
    private analyticsPrisma: AnalyticsPrismaService,
    private prisma: PrismaService,
  ) {}

  private getPeriodDays(period: string): number {
    return { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365, 'all': 3650 }[period] ?? 7
  }

  private getPeriodStart(period: string): Date {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - this.getPeriodDays(period))
    start.setHours(0, 0, 0, 0)
    return start
  }

  private trendChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  // ─── Overview ───────────────────────────────────────────────────────────────

  async getOverview(storeId: string, period: string) {
    const days = this.getPeriodDays(period)
    const start = this.getPeriodStart(period)
    const prevStart = new Date(start.getTime() - days * 86400000)

    const [dailyRows, prevDailyRows, orders, prevOrders] = await Promise.all([
      this.analyticsPrisma.analyticsDaily.findMany({
        where: { storeId, date: { gte: start } },
      }),
      this.analyticsPrisma.analyticsDaily.findMany({
        where: { storeId, date: { gte: prevStart, lt: start } },
      }),
      this.prisma.order.findMany({
        where: { storeId, createdAt: { gte: start } },
        select: { total: true },
      }),
      this.prisma.order.findMany({
        where: { storeId, createdAt: { gte: prevStart, lt: start } },
        select: { total: true },
      }),
    ])

    const totalVisitors = dailyRows.reduce((s, r) => s + r.uniqueVisitors, 0)
    const totalPageViews = dailyRows.reduce((s, r) => s + r.pageViews, 0)
    const avgDuration = dailyRows.length
      ? Math.round(dailyRows.reduce((s, r) => s + r.avgDuration, 0) / dailyRows.length)
      : 0
    const cartAdds = dailyRows.reduce((s, r) => s + r.cartAdds, 0)
    const cartAbandons = dailyRows.reduce((s, r) => s + r.cartAbandons, 0)
    const checkoutStarts = dailyRows.reduce((s, r) => s + r.checkoutStarts, 0)

    const totalOrders = orders.length
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0
    const conversionRate = totalVisitors ? (totalOrders / totalVisitors) * 100 : 0

    const prevVisitors = prevDailyRows.reduce((s, r) => s + r.uniqueVisitors, 0)
    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0)
    const prevOrderCount = prevOrders.length

    return {
      totalVisitors,
      totalPageViews,
      avgDuration,
      bounceRate: 0,
      cartAdds,
      cartAbandons,
      checkoutStarts,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      trend: {
        visitors: this.trendChange(totalVisitors, prevVisitors),
        revenue: this.trendChange(totalRevenue, prevRevenue),
        orders: this.trendChange(totalOrders, prevOrderCount),
      },
    }
  }

  // ─── Traffic ─────────────────────────────────────────────────────────────────

  async getTraffic(storeId: string, period: string) {
    const start = this.getPeriodStart(period)

    const rows = await this.analyticsPrisma.analyticsDaily.findMany({
      where: { storeId, date: { gte: start } },
      orderBy: { date: 'asc' },
    })

    const daily = rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      visitors: r.uniqueVisitors,
      pageViews: r.pageViews,
    }))

    const mobile = rows.reduce((s, r) => s + r.mobileCount, 0)
    const tablet = rows.reduce((s, r) => s + r.tabletCount, 0)
    const desktop = rows.reduce((s, r) => s + r.desktopCount, 0)
    const organic = rows.reduce((s, r) => s + r.organicCount, 0)
    const social = rows.reduce((s, r) => s + r.socialCount, 0)
    const direct = rows.reduce((s, r) => s + r.directCount, 0)
    const referral = rows.reduce((s, r) => s + r.referralCount, 0)

    // Merge countries across days — sum by country
    const countryMap: Record<string, number> = {}
    for (const row of rows) {
      const countries = row.countries as Array<{ country: string; count: number }>
      for (const c of countries) {
        countryMap[c.country] = (countryMap[c.country] || 0) + c.count
      }
    }
    const countries = Object.entries(countryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }))

    return {
      daily,
      devices: { mobile, tablet, desktop },
      sources: { organic, social, direct, referral },
      countries,
    }
  }

  // ─── Pages ───────────────────────────────────────────────────────────────────
  // Queries raw hypertable — this is an explicit exception per spec
  // AnalyticsDaily.topPages is a JSON blob; per-page granularity requires raw query
  async getPages(storeId: string, period: string) {
    const start = this.getPeriodStart(period)

    const rows = await this.analyticsPrisma.$queryRaw<
      Array<{ page_slug: string; views: bigint; avg_duration: number | null }>
    >`
      SELECT
        page_slug,
        COUNT(*) as views,
        AVG(duration) as avg_duration
      FROM page_views
      WHERE store_id = ${storeId}
        AND time >= ${start}
      GROUP BY page_slug
      ORDER BY views DESC
      LIMIT 20
    `

    return {
      pages: rows.map(r => ({
        slug: r.page_slug,
        views: Number(r.views),
        avgDuration: r.avg_duration ? Math.round(Number(r.avg_duration)) : 0,
        bounceRate: 0,
      })),
    }
  }

  // ─── Funnel ──────────────────────────────────────────────────────────────────

  async getFunnel(storeId: string, period: string) {
    const start = this.getPeriodStart(period)
    const where = { storeId, time: { gte: start } }

    const [dailyRows, productViews, cartAdds, checkoutStarts, purchases] = await Promise.all([
      this.analyticsPrisma.analyticsDaily.findMany({
        where: { storeId, date: { gte: start } },
        select: { uniqueVisitors: true },
      }),
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'PRODUCT_VIEW' },
      }),
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'CART_ADD' },
      }),
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'CHECKOUT_START' },
      }),
      // Sales from Orders model (ANALYTICS-RULE 10)
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: start } },
      }),
    ])

    const visitors = dailyRows.reduce((s, r) => s + r.uniqueVisitors, 0)

    return {
      steps: [
        { name: 'زوار', count: visitors },
        { name: 'مشاهدة منتج', count: productViews },
        { name: 'إضافة للسلة', count: cartAdds },
        { name: 'بدء الدفع', count: checkoutStarts },
        { name: 'إتمام الشراء', count: purchases },
      ],
    }
  }

  // ─── Sales ───────────────────────────────────────────────────────────────────
  // All from Orders model — ANALYTICS-RULE 10 (never from tracking events)

  async getSales(storeId: string, period: string) {
    const start = this.getPeriodStart(period)

    const orders = await this.prisma.order.findMany({
      where: { storeId, createdAt: { gte: start } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })

    // Daily aggregation
    const dailyMap: Record<string, { orders: number; revenue: number }> = {}
    for (const order of orders) {
      const date = order.createdAt.toISOString().split('T')[0]
      if (!dailyMap[date]) dailyMap[date] = { orders: 0, revenue: 0 }
      dailyMap[date].orders++
      dailyMap[date].revenue += Number(order.total)
    }

    const daily = Object.entries(dailyMap).map(([date, d]) => ({
      date,
      orders: d.orders,
      revenue: Math.round(d.revenue * 100) / 100,
    }))

    // Top products by revenue
    const productMap: Record<string, { productName: string; quantity: number; revenue: number }> = {}
    for (const order of orders) {
      for (const item of order.items) {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { productName: item.productName, quantity: 0, revenue: 0 }
        }
        productMap[item.productId].quantity += item.quantity
        productMap[item.productId].revenue += Number(item.total)
      }
    }
    const topProducts = Object.entries(productMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([productId, p]) => ({
        productId,
        productName: p.productName,
        quantity: p.quantity,
        revenue: Math.round(p.revenue * 100) / 100,
      }))

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0

    return {
      daily,
      topProducts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    }
  }

  // ─── Heatmap ─────────────────────────────────────────────────────────────────
  // ANALYTICS-RULE 9: min 100 points before returning data

  async getHeatmap(storeId: string, page: string, type: string, device: string) {
    const rows = await this.analyticsPrisma.$queryRaw<
      Array<{ x: number; y: number; weight: bigint }>
    >`
      SELECT
        ROUND(x::numeric, 0) as x,
        ROUND(y::numeric, 0) as y,
        COUNT(*) as weight
      FROM heatmap_data
      WHERE store_id = ${storeId}
        AND page_slug = ${page}
        AND type::text = ${type}
        AND device::text = ${device}
        AND time >= NOW() - INTERVAL '30 days'
      GROUP BY
        ROUND(x::numeric, 0),
        ROUND(y::numeric, 0)
      ORDER BY weight DESC
      LIMIT 10000
    `

    const total = rows.length

    // Insufficient data (ANALYTICS-RULE 9)
    if (total < 100) {
      return { points: [], total: 0, message: 'بيانات غير كافية بعد' }
    }

    return {
      points: rows.map(r => ({
        x: Number(r.x),
        y: Number(r.y),
        weight: Number(r.weight),
      })),
      total,
    }
  }
}
