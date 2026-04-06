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
import { GenerationStatus } from '@prisma/client';

export const LANDING_PAGE_QUEUE = 'landing-page-generation';

@Injectable()
export class LandingPageService {
  private readonly logger = new Logger(LandingPageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(LANDING_PAGE_QUEUE) private readonly queue: Queue,
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
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Generation ${generation.id} enqueued for store ${storeId}`);

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
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { id: generationId, status: GenerationStatus.PENDING };
  }
}
