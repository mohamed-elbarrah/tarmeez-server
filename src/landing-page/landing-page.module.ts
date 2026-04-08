import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantModule } from '../merchant/merchant.module';
import { LandingPageController } from './landing-page.controller';
import { LandingPageService, LANDING_PAGE_QUEUE } from './landing-page.service';
import { LandingPageProcessor } from './landing-page.processor';
import { LandingPageOrchestrator } from './landing-page.orchestrator';
import { LandingPageRefiner } from './landing-page.refiner';
import { NormalizationService } from './normalization.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [
    PrismaModule,
    MerchantModule,
    BullModule.registerQueue({
      name: LANDING_PAGE_QUEUE,
    }),
  ],
  controllers: [LandingPageController],
  providers: [
    LandingPageService,
    LandingPageProcessor,
    LandingPageOrchestrator,
    LandingPageRefiner,
    NormalizationService,
    {
      provide: AI_PROVIDER,
      useClass: GeminiProvider,
    },
  ],
  exports: [LandingPageService],
})
export class LandingPageModule {}
