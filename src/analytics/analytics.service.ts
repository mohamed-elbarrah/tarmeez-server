import { Injectable } from '@nestjs/common'
import { AnalyticsPrismaService } from './analytics-prisma.service'
import { PrismaService } from '../prisma/prisma.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
export class AnalyticsService {
  // Store resolution cache — 5 minute TTL (ANALYTICS-RULE 6)
  // Keys can be either UUID storeId or storeSlug; value is resolved storeId
  private storeCache = new Map<string, {
    storeId: string | null
    cachedAt: number
  }>()

  constructor(
    private analyticsPrisma: AnalyticsPrismaService,
    private prisma: PrismaService,
    // ↑ regular prisma for store validation only
  ) {}

  /**
   * Resolve storeRef (UUID or slug) to the actual storeId UUID.
   * Returns null for unknown stores.
   * (ANALYTICS-RULE 6 — validates every incoming event)
   */
  async resolveStore(ref: string): Promise<string | null> {
    const cached = this.storeCache.get(ref)
    const now = Date.now()
    if (cached !== undefined && now - cached.cachedAt < 300000) {
      return cached.storeId
    }

    let store: { id: string; slug: string } | null = null

    // Try UUID lookup first (exact primary key hit)
    if (UUID_RE.test(ref)) {
      store = await this.prisma.store
        .findUnique({ where: { id: ref }, select: { id: true, slug: true } })
        .catch(() => null)
    }

    // Fall back to slug lookup
    if (!store) {
      store = await this.prisma.store
        .findUnique({ where: { slug: ref }, select: { id: true, slug: true } })
        .catch(() => null)
    }

    const storeId = store?.id ?? null

    // Cache by the ref used AND by both id/slug for cross-lookup
    const entry = { storeId, cachedAt: now }
    this.storeCache.set(ref, entry)
    if (store) {
      if (store.id !== ref) this.storeCache.set(store.id, entry)
      if (store.slug !== ref) this.storeCache.set(store.slug, entry)
    }

    return storeId
  }

  /** Backward-compat wrapper — prefer resolveStore() */
  async isValidStore(ref: string): Promise<boolean> {
    return (await this.resolveStore(ref)) !== null
  }

  async processBatch(events: any[]): Promise<void> {
    const pageviews = events.filter(e => e.type === 'pageview')
    const heatmapEvents = events.filter(
      e => e.type === 'click' || e.type === 'move',
    )
    const analyticsEvents = events.filter(e =>
      ['cart_add', 'cart_abandon', 'checkout_start', 'product_view'].includes(e.type),
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
      product_view: 'PRODUCT_VIEW',
    }
    return map[t] ?? 'BUTTON_CLICK'
  }
}
