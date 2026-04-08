import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGenerationDto } from './dto';
import { RefinePageDto } from './dto/refine-page.dto';
import { LandingPageRefiner, type RefineResult } from './landing-page.refiner';
import { GenerationStatus } from '@prisma/client';

export const LANDING_PAGE_QUEUE = 'landing-page-generation';

@Injectable()
export class LandingPageService {
  private readonly logger = new Logger(LandingPageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(LANDING_PAGE_QUEUE) private readonly queue: Queue,
    private readonly refiner: LandingPageRefiner,
  ) {}

  async createGeneration(storeId: string, dto: CreateGenerationDto) {
    // If productId provided, validate it belongs to this store
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, storeId },
      });
      if (!product) {
        throw new NotFoundException('Product not found in this store');
      }
    }

    // Create the generation record
    const generation = await this.prisma.landingPageGeneration.create({
      data: {
        storeId,
        productId: dto.productId,
        prompt: dto.prompt,
        language: dto.language ?? 'ar',
        tone: dto.tone ?? 'professional',
        status: GenerationStatus.PENDING,
      },
    });

    // Enqueue the job
    await this.queue.add(
      'generate',
      {
        generationId: generation.id,
        storeId,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Generation ${generation.id} enqueued for store ${storeId}`,
    );

    return {
      id: generation.id,
      status: generation.status,
      createdAt: generation.createdAt,
    };
  }

  async getGeneration(storeId: string, generationId: string) {
    const generation = await this.prisma.landingPageGeneration.findFirst({
      where: { id: generationId, storeId },
    });

    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    return generation;
  }

  async listGenerations(storeId: string) {
    return this.prisma.landingPageGeneration.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        prompt: true,
        language: true,
        tone: true,
        pageId: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async retryGeneration(storeId: string, generationId: string) {
    const generation = await this.prisma.landingPageGeneration.findFirst({
      where: { id: generationId, storeId },
    });

    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    if (generation.status !== GenerationStatus.FAILED) {
      throw new BadRequestException('Only failed generations can be retried');
    }

    await this.prisma.landingPageGeneration.update({
      where: { id: generationId },
      data: {
        status: GenerationStatus.PENDING,
        errorMessage: null,
      },
    });

    await this.queue.add(
      'generate',
      {
        generationId: generation.id,
        storeId,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { id: generationId, status: GenerationStatus.PENDING };
  }

  async refine(
    pageId: string,
    storeId: string,
    dto: RefinePageDto,
  ): Promise<RefineResult> {
    // 1. Verify page belongs to this store
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });
    if (!page) throw new NotFoundException('Page not found');

    // 2. Delegate to refiner (synchronous AI call — user is waiting)
    const result = await this.refiner.refine(dto, pageId, storeId);

    // 3. If success, persist updated content to DB
    if (result.success) {
      await this.prisma.page.update({
        where: { id: pageId },
        data: {
          content: result.updatedContent as any,
          updatedAt: new Date(),
        },
      });
    }

    return result;
  }
}
