import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(dto: CreateReviewDto, userId: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug: dto.storeSlug }
    });

    if (!store) throw new NotFoundException('Store not found');

    const customer = await this.prisma.customer.findUnique({
      where: { storeId_userId: { storeId: store.id, userId } }
    });

    if (!customer) throw new ForbiddenException('Not registered in this store');

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, storeId: store.id }
    });

    if (!product) throw new NotFoundException('Product not found in this store');

    const existingReview = await this.prisma.review.findUnique({
      where: { customerId_productId: { customerId: customer.id, productId: dto.productId } }
    });

    if (existingReview) throw new ConflictException('لقد قمت بتقييم هذا المنتج مسبقاً');

    const review = await this.prisma.review.create({
      data: {
        storeId: store.id,
        productId: dto.productId,
        customerId: customer.id,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        customer: { select: { fullName: true } }
      }
    });

    return review;
  }

  async getProductReviews(productId: string, storeSlug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug }
    });
    if (!store) throw new NotFoundException('Store not found');

    const reviews = await this.prisma.review.findMany({
      where: { productId, storeId: store.id },
      include: {
        customer: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalReviews = reviews.length;
    let averageRating = 0;
    
    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      averageRating = sum / totalReviews;
    }

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of reviews) {
      if (review.rating >= 1 && review.rating <= 5) {
        distribution[review.rating as keyof typeof distribution]++;
      }
    }

    return {
      reviews,
      totalReviews,
      averageRating,
      distribution
    };
  }

  async deleteReview(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { customer: true }
    });

    if (!review) throw new NotFoundException('Review not found');

    if (review.customer.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id: reviewId }
    });

    return { success: true };
  }
}
