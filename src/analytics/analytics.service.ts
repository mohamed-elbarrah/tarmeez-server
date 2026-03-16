import { Injectable } from '@nestjs/common'
import { AnalyticsPrismaService } from './analytics-prisma.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AnalyticsService {
  // Store validation cache — 5 minute TTL (ANALYTICS-RULE 6)
  private storeCache = new Map<string, {
    valid: boolean
    cachedAt: number
  }>()

  constructor(
    private analyticsPrisma: AnalyticsPrismaService,
    private prisma: PrismaService,
    // ↑ regular prisma for store validation only
  ) {}

  async isValidStore(storeId: string): Promise<boolean> {
    const cached = this.storeCache.get(storeId)
    const now = Date.now()
    if (cached && now - cached.cachedAt < 300000) {
      return cached.valid
    }
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    })
    const valid = !!store
    this.storeCache.set(storeId, { valid, cachedAt: now })
    return valid
  }

  async processBatch(events: any[]): Promise<void> {
    const pageviews = events.filter(e => e.type === 'pageview')
    const heatmapEvents = events.filter(
      e => e.type === 'click' || e.type === 'move',
    )
    const analyticsEvents = events.filter(e =>
      ['cart_add', 'cart_abandon', 'checkout_start'].includes(e.type),
    )
    const scrollEvents = events.filter(e => e.type === 'scroll')

    const ops: Promise<any>[] = []

    if (pageviews.length > 0) {
      ops.push(
        this.analyticsPrisma.pageView.createMany({
          data: pageviews.map(e => ({
            storeId: e.storeId,
            sessionId: e.sessionId,
            pageSlug: e.page,
            referrer: e.referrer || null,
            device: this.parseDevice(e.device),
            browser: e.browser || null,
            country: e.country || null,
            time: new Date(e.ts),
          })),
          skipDuplicates: true,
        }),
      )
    }

    if (heatmapEvents.length > 0) {
      ops.push(
        this.analyticsPrisma.heatmapData.createMany({
          data: heatmapEvents.map(e => ({
            storeId: e.storeId,
            pageSlug: e.page,
            x: e.x ?? 0,
            y: e.y ?? 0,
            type: e.type === 'click' ? 'CLICK' : 'MOVE',
            device: this.parseDevice(e.device),
            time: new Date(e.ts),
          })),
          skipDuplicates: true,
        }),
      )
    }

    if (analyticsEvents.length > 0) {
      ops.push(
        this.analyticsPrisma.analyticsEvent.createMany({
          data: analyticsEvents.map(e => ({
            storeId: e.storeId,
            sessionId: e.sessionId,
            type: this.parseEventType(e.type),
            pageSlug: e.page,
            metadata: e.metadata || null,
            time: new Date(e.ts),
          })),
          skipDuplicates: true,
        }),
      )
    }

    // Update scroll depth as duration on latest PageView for session+page
    for (const e of scrollEvents) {
      if (e.depth && e.depth > 0) {
        ops.push(
          this.analyticsPrisma.pageView.updateMany({
            where: {
              storeId: e.storeId,
              sessionId: e.sessionId,
              pageSlug: e.page,
            },
            data: { duration: e.depth },
          }),
        )
      }
    }

    try {
      await Promise.all(ops)
    } catch (err) {
      // Log but never throw — analytics must never crash the server
      console.error('Analytics processBatch error:', err)
    }
  }

  private parseDevice(d: string): any {
    if (d === 'mobile') return 'MOBILE'
    if (d === 'tablet') return 'TABLET'
    if (d === 'desktop') return 'DESKTOP'
    return 'UNKNOWN'
  }

  private parseEventType(t: string): any {
    const map: Record<string, string> = {
      cart_add: 'CART_ADD',
      cart_abandon: 'CART_ABANDON',
      checkout_start: 'CHECKOUT_START',
    }
    return map[t] ?? 'BUTTON_CLICK'
  }
}
