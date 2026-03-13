import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('merchant/categories')
@UseGuards(MerchantGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly prisma: PrismaService,
  ) {}

  private async getStoreId(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store) {
      throw new NotFoundException('Store not found for this merchant');
    }
    return merchant.store.id;
  }

  @Get()
  async getCategories(@Req() req) {
    const storeId = await this.getStoreId(req.user.id);
    return this.categoriesService.getCategories(storeId);
  }

  @Get(':id')
  async getCategoryById(@Req() req, @Param('id') id: string) {
    const storeId = await this.getStoreId(req.user.id);
    return this.categoriesService.getCategoryById(storeId, id);
  }

  @Post()
  async createCategory(@Req() req, @Body() dto: CreateCategoryDto) {
    const storeId = await this.getStoreId(req.user.id);
    return this.categoriesService.createCategory(storeId, dto);
  }

  @Patch(':id')
  async updateCategory(@Req() req, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const storeId = await this.getStoreId(req.user.id);
    return this.categoriesService.updateCategory(storeId, id, dto);
  }

  @Delete(':id')
  async deleteCategory(@Req() req, @Param('id') id: string) {
    const storeId = await this.getStoreId(req.user.id);
    return this.categoriesService.deleteCategory(storeId, id);
  }
}
