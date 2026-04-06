import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_PROVIDER,
  type AIProvider,
  type ProductContext,
  type SectionGenerationContext,
} from './providers';
import { LANDING_PAGE_QUEUE } from './landing-page.service';
import { NormalizationService } from './normalization.service';
import { GenerationStatus } from '@prisma/client';

interface GenerationJobData {
  generationId: string;
  storeId: string;
}

@Processor(LANDING_PAGE_QUEUE)
export class LandingPageProcessor extends WorkerHost {
  private readonly logger = new Logger(LandingPageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly normalization: NormalizationService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { generationId, storeId } = job.data;
    this.logger.log(`[${generationId}] Job received`);

    // Mark as PROCESSING
    const generation = await this.prisma.landingPageGeneration.update({
      where: { id: generationId },
      data: { status: GenerationStatus.PROCESSING },
    });

    try {
      // ── Load product context ─────────────────────────────
      const productContext = await this.loadProductContext(
        generation.productId,
      );

      // ── Step 1: Analyze ──────────────────────────────────
      this.logger.log(`[${generationId}] Step 1/3 — Analyzing product...`);
      const analysis = await this.aiProvider.analyzeProduct(
        generation.prompt,
        productContext,
        generation.language,
        generation.tone,
      );
      this.logger.debug(
        `[${generationId}] Analysis: category=${analysis.productCategory}, ` +
          `audience=${analysis.targetAudience.slice(0, 60)}...`,
      );

      // ── Step 2: Plan ─────────────────────────────────────
      this.logger.log(
        `[${generationId}] Step 2/3 — Planning page structure...`,
      );
      const plan = await this.aiProvider.planPage(
        analysis,
        generation.language,
        generation.tone,
      );
      this.logger.log(
        `[${generationId}] Plan: ${plan.selectedSections.length} sections → ${plan.selectedSections.join(', ')}`,
      );

      // ── Step 3: Generate each section ────────────────────
      this.logger.log(
        `[${generationId}] Step 3/3 — Generating ${plan.selectedSections.length} sections...`,
      );
      const sections: unknown[] = [];
      const sectionErrors: string[] = [];

      for (const sectionType of plan.selectedSections) {
        try {
          const ctx: SectionGenerationContext = {
            sectionType,
            analysis,
            language: generation.language,
            tone: generation.tone,
            ...productContext,
          };
          const section = await this.aiProvider.generateSection(ctx);
          sections.push(section);
          this.logger.debug(`[${generationId}]   ✓ ${sectionType}`);
        } catch (sectionErr) {
          const msg =
            sectionErr instanceof Error
              ? sectionErr.message
              : String(sectionErr);
          this.logger.warn(`[${generationId}]   ✗ ${sectionType}: ${msg}`);
          sectionErrors.push(`${sectionType}: ${msg}`);
          // Normalization will handle partial results gracefully
        }
      }

      if (sections.length === 0) {
        throw new Error(
          `All section generations failed: ${sectionErrors.join('; ')}`,
        );
      }

      // ── Normalize & validate ─────────────────────────────
      const rawOutput = {
        sections,
        metadata: { language: generation.language, tone: generation.tone },
      };

      const normalized = this.normalization.normalize(rawOutput);

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

      // ── Create Page ──────────────────────────────────────
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

      // ── Mark COMPLETED ───────────────────────────────────
      const sectionCount = Array.isArray(normalized.data.sections)
        ? (normalized.data.sections as unknown[]).length
        : 0;

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
        `[${generationId}] Done — ${sectionCount} sections → Page ${page.id}`,
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

  // ── Helpers ─────────────────────────────────────────────────
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
