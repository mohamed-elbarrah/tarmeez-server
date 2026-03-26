import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalyticsPrismaService } from './analytics-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AggregationService {
  constructor(
    private analyticsPrisma: AnalyticsPrismaService,
    private prisma: PrismaService,
  ) {}

  @Cron('0 * * * *') // Every hour
  async aggregateHourly() {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const prevHour = new Date(hour.getTime() - 3600000);

    const stores = await this.prisma.store.findMany({
      select: { id: true },
    });

    for (const store of stores) {
      try {
        await this.computeHour(store.id, prevHour);
      } catch (err) {
        // Log and continue — never stop the loop (ANALYTICS-RULE 11)
        console.error(`Hourly agg failed for ${store.id}:`, err);
      }
      // 100ms delay between stores to avoid DB spike (ANALYTICS-RULE 11)
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  @Cron('0 0 * * *') // Every midnight UTC
  async aggregateDaily() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const stores = await this.prisma.store.findMany({
      select: { id: true },
    });

    for (const store of stores) {
      try {
        await this.computeDay(store.id, yesterday);
      } catch (err) {
        console.error(`Daily agg failed for ${store.id}:`, err);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async computeHour(storeId: string, hour: Date): Promise<void> {
    const nextHour = new Date(hour.getTime() + 3600000);
    const where = {
      storeId,
      time: { gte: hour, lt: nextHour },
    };

    const [views, sessions, mobile, tablet, cartAdds, abandons, checkouts] =
      await Promise.all([
        this.analyticsPrisma.pageView.count({ where }),
        this.analyticsPrisma.pageView.groupBy({ by: ['sessionId'], where }),
        this.analyticsPrisma.pageView.count({
          where: { ...where, device: 'MOBILE' },
        }),
        this.analyticsPrisma.pageView.count({
          where: { ...where, device: 'TABLET' },
        }),
        this.analyticsPrisma.analyticsEvent.count({
          where: { ...where, type: 'CART_ADD' },
        }),
        this.analyticsPrisma.analyticsEvent.count({
          where: { ...where, type: 'CART_ABANDON' },
        }),
        this.analyticsPrisma.analyticsEvent.count({
          where: { ...where, type: 'CHECKOUT_START' },
        }),
      ]);

    // Upsert — idempotent (ANALYTICS-RULE 11)
    await this.analyticsPrisma.analyticsHourly.upsert({
      where: { storeId_hour: { storeId, hour } },
      create: {
        storeId,
        hour,
        pageViews: views,
        uniqueVisitors: sessions.length,
        mobileCount: mobile,
        tabletCount: tablet,
        desktopCount: views - mobile - tablet,
        cartAdds,
        cartAbandons: abandons,
        checkoutStarts: checkouts,
      },
      update: {
        pageViews: views,
        uniqueVisitors: sessions.length,
        mobileCount: mobile,
        tabletCount: tablet,
        desktopCount: views - mobile - tablet,
        cartAdds,
        cartAbandons: abandons,
        checkoutStarts: checkouts,
      },
    });
  }

  private async computeDay(storeId: string, date: Date): Promise<void> {
    const nextDay = new Date(date.getTime() + 86400000);
    const where = {
      storeId,
      time: { gte: date, lt: nextDay },
    };

    const views = await this.analyticsPrisma.pageView.findMany({
      where,
      select: {
        referrer: true,
        device: true,
        sessionId: true,
        country: true,
        duration: true,
      },
    });

    const uniqueSessions = new Set(views.map((v) => v.sessionId)).size;

    const organic = views.filter(
      (v) => v.referrer && /google|bing|yahoo|duckduckgo/.test(v.referrer),
    ).length;

    const social = views.filter(
      (v) =>
        v.referrer &&
        /facebook|twitter|instagram|tiktok|x\.com/.test(v.referrer),
    ).length;

    const direct = views.filter((v) => !v.referrer).length;
    const referral = views.length - organic - social - direct;

    // Top countries — max 10
    const countryMap = views.reduce(
      (acc, v) => {
        if (v.country) acc[v.country] = (acc[v.country] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const countries = Object.entries(countryMap)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    const durViews = views.filter((v) => v.duration);
    const avgDuration = durViews.length
      ? durViews.reduce((s, v) => s + (v.duration || 0), 0) / durViews.length
      : 0;

    const [cartAdds, abandons, checkouts] = await Promise.all([
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'CART_ADD' },
      }),
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'CART_ABANDON' },
      }),
      this.analyticsPrisma.analyticsEvent.count({
        where: { ...where, type: 'CHECKOUT_START' },
      }),
    ]);

    const mobile = views.filter((v) => v.device === 'MOBILE').length;
    const tablet = views.filter((v) => v.device === 'TABLET').length;
    const desktop = views.filter((v) => v.device === 'DESKTOP').length;

    await this.analyticsPrisma.analyticsDaily.upsert({
      where: { storeId_date: { storeId, date } },
      create: {
        storeId,
        date,
        pageViews: views.length,
        uniqueVisitors: uniqueSessions,
        avgDuration: Math.round(avgDuration),
        mobileCount: mobile,
        tabletCount: tablet,
        desktopCount: desktop,
        organicCount: organic,
        socialCount: social,
        directCount: direct,
        referralCount: referral,
        countries,
        cartAdds,
        cartAbandons: abandons,
        checkoutStarts: checkouts,
      },
      update: {
        pageViews: views.length,
        uniqueVisitors: uniqueSessions,
        avgDuration: Math.round(avgDuration),
        mobileCount: mobile,
        tabletCount: tablet,
        desktopCount: desktop,
        organicCount: organic,
        socialCount: social,
        directCount: direct,
        referralCount: referral,
        countries,
        cartAdds,
        cartAbandons: abandons,
        checkoutStarts: checkouts,
      },
    });
  }
}
