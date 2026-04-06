import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AIProvider, type AIGenerationInput } from './providers';
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
    this.logger.log(`Processing generation ${generationId}`);

    // Mark as processing
    const generation = await this.prisma.landingPageGeneration.update({
      where: { id: generationId },
      data: { status: GenerationStatus.PROCESSING },
    });

    try {
      // Gather product context if linked
      let productContext: Partial<AIGenerationInput> = {};
      if (generation.productId) {
        const product = await this.prisma.product.findUnique({
          where: { id: generation.productId },
          select: { name: true, description: true, price: true },
        });
        if (product) {
          productContext = {
            productName: product.name,
            productDescription: product.description ?? undefined,
            productPrice: product.price ? Number(product.price) : undefined,
          };
        }
      }

      // Call AI provider
      const aiOutput = await this.aiProvider.generate({
        prompt: generation.prompt,
        language: generation.language,
        tone: generation.tone,
        ...productContext,
      });

      // Normalize and validate
      const normalized = this.normalization.normalize(aiOutput.parsed);

      if (!normalized.success || !normalized.data) {
        const errorMsg = normalized.errors
          .map((e) => `[${e.section}] ${e.path}: ${e.message}`)
          .join('; ');
        throw new Error(`AI output validation failed: ${errorMsg}`);
      }

      if (normalized.warnings.length > 0) {
        this.logger.warn(
          `Generation ${generationId} warnings: ${normalized.warnings.join(', ')}`,
        );
      }

      // Create a Page from the generated content
      const slug = `ai-landing-${generationId.slice(0, 8)}-${Date.now()}`;
      const page = await this.prisma.page.create({
        data: {
          storeId,
          title: `AI Landing Page`,
          slug,
          type: 'LANDING',
          status: 'DRAFT',
          content: normalized.data as any,
          linkedProductId: generation.productId,
        },
      });

      // Mark generation as completed with link to page
      await this.prisma.landingPageGeneration.update({
        where: { id: generationId },
        data: {
          status: GenerationStatus.COMPLETED,
          content: normalized.data as any,
          pageId: page.id,
          retryCount: { increment: 1 },
        },
      });

      this.logger.log(`Generation ${generationId} completed → Page ${page.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Generation ${generationId} failed: ${message}`);

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
}
