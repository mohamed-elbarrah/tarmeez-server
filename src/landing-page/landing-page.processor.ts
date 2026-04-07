import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AIProvider, type ProductContext } from './providers';
import { LANDING_PAGE_QUEUE } from './landing-page.service';
import { NormalizationService } from './normalization.service';
import { LandingPageOrchestrator } from './landing-page.orchestrator';
import { GenerationStatus } from '@prisma/client';

interface GenerationJobData {
  generationId: string;
  storeId: string;
}

// ─── Thin processor layer ─────────────────────────────────────
// All AI orchestration is delegated to LandingPageOrchestrator.
// This class is responsible only for:
//   - marking job status in the DB
//   - loading product context
//   - persisting the generated page
//   - error handling + BullMQ retries

@Processor(LANDING_PAGE_QUEUE)
export class LandingPageProcessor extends WorkerHost {
  private readonly logger = new Logger(LandingPageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly normalization: NormalizationService,
    private readonly orchestrator: LandingPageOrchestrator,
  ) {
    super();
  }

  /**
   * KNOWN LIMITATION — Retry cost:
   * In the old system, a single failed section = 1 retry call.
   * In the new system, any failure = full 3-call retry.
   * This is acceptable at current scale.
   * Future improvement: add section-level checkpointing.
   */
  async process(job: Job<GenerationJobData>): Promise<void> {
    const { generationId, storeId } = job.data;
    this.logger.log(`[${generationId}] Job received`);

    const generation = await this.prisma.landingPageGeneration.update({
      where: { id: generationId },
      data: { status: GenerationStatus.PROCESSING },
    });

    try {
      const productContext = await this.loadProductContext(
        generation.productId,
      );

      // All AI calls handled by orchestrator (3 calls: analyze+plan, light, heavy)
      const { normalized, metrics } = await this.orchestrator.generate(
        generation.prompt,
        productContext,
        generation.language,
        generation.tone,
        generationId,
      );

      if (!normalized.success || !normalized.data) {
        const errorMsg = normalized.errors
          .map((e) => `[${e.section}] ${e.path}: ${e.message}`)
          .join('; ');
        throw new Error(`Normalization failed: ${errorMsg}`);
      }

      if (normalized.warnings.length > 0) {
        this.logger.warn(
          `[${generationId}] Normalization warnings: ${normalized.warnings.join(', ')}`,
        );
      }

      const slug = `ai-landing-${generationId.slice(0, 8)}-${Date.now()}`;
      const pageTitle = productContext.productName
        ? `AI Page — ${productContext.productName}`
        : 'AI Landing Page';

      const page = await this.prisma.page.create({
        data: {
          storeId,
          title: pageTitle,
          slug,
          type: 'LANDING',
          status: 'PUBLISHED',
          content: normalized.data as any,
          linkedProductId: generation.productId ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.prisma.landingPageGeneration.update({
        where: { id: generationId },
        data: {
          status: GenerationStatus.COMPLETED,
          content: normalized.data as any,
          pageId: page.id,
          retryCount: { increment: 1 },
        },
      });

      this.logger.log(
        `[${generationId}] Done — ${metrics.sectionsGenerated} sections → Page ${page.id} ` +
          `(calls: ${metrics.totalCalls}, ${metrics.durationMs}ms)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[${generationId}] Failed: ${message}`);

      await this.prisma.landingPageGeneration.update({
        where: { id: generationId },
        data: {
          status: GenerationStatus.FAILED,
          errorMessage: message.slice(0, 2000),
          retryCount: { increment: 1 },
        },
      });

      throw error; // Let BullMQ handle retries
    }
  }

  private async loadProductContext(
    productId: string | null,
  ): Promise<ProductContext> {
    if (!productId) return {};

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, description: true, price: true },
    });

    if (!product) return {};

    return {
      productName: product.name,
      productDescription: product.description ?? undefined,
      productPrice: product.price ? Number(product.price) : undefined,
    };
  }
}
