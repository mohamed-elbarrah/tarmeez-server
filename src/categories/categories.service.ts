import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async getCategories(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async getCategoryById(storeId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(storeId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { ...dto, storeId },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category slug already exists for this store');
      }
      throw error;
    }
  }

  async updateCategory(storeId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.getCategoryById(storeId, categoryId);
    try {
      return await this.prisma.category.update({
        where: { id: categoryId },
        data: dto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category slug already exists for this store');
      }
      throw error;
    }
  }

  async deleteCategory(storeId: string, categoryId: string) {
    await this.getCategoryById(storeId, categoryId);
    // Unlink products from this category before deleting
    await this.prisma.product.updateMany({
      where: { categoryId },
      data: { categoryId: null, category: null },
    });
    await this.prisma.category.delete({ where: { id: categoryId } });
    return { message: 'Category deleted' };
  }
}
