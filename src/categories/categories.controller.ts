import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { Action } from '../common/enums/action.enum';
import { Resource } from '../common/enums/resource.enum';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('merchant/categories')
@UseGuards(MerchantGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @Permissions(Resource.CATEGORIES, Action.READ)
  async getCategories(@Req() req) {
    return this.categoriesService.getCategories(req.activeStore.id);
  }

  @Get(':id')
  @Permissions(Resource.CATEGORIES, Action.READ)
  async getCategoryById(@Req() req, @Param('id') id: string) {
    return this.categoriesService.getCategoryById(req.activeStore.id, id);
  }

  @Post()
  @Permissions(Resource.CATEGORIES, Action.CREATE)
  async createCategory(@Req() req, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(req.activeStore.id, dto);
  }

  @Patch(':id')
  @Permissions(Resource.CATEGORIES, Action.UPDATE)
  async updateCategory(@Req() req, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.updateCategory(req.activeStore.id, id, dto);
  }

  @Delete(':id')
  @Permissions(Resource.CATEGORIES, Action.DELETE)
  async deleteCategory(@Req() req, @Param('id') id: string) {
    return this.categoriesService.deleteCategory(req.activeStore.id, id);
  }
}

