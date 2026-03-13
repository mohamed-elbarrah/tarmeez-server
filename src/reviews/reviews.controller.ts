import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CustomerGuard } from '../auth/guards/customer.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type JwtUser = { id: string; storeId?: string; role?: string };

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(CustomerGuard)
  @Post()
  createReview(@Body() dto: CreateReviewDto, @CurrentUser() user: JwtUser) {
    return this.reviewsService.createReview(dto, user.id);
  }

  @Get(':productId')
  getProductReviews(
    @Param('productId') productId: string,
    @Query('storeSlug') storeSlug: string
  ) {
    return this.reviewsService.getProductReviews(productId, storeSlug);
  }

  @UseGuards(CustomerGuard)
  @Delete(':reviewId')
  deleteReview(@Param('reviewId') reviewId: string, @CurrentUser() user: JwtUser) {
    return this.reviewsService.deleteReview(reviewId, user.id);
  }
}
