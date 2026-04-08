import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdatePageStatusDto } from './dto/update-page-status.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { Action } from '../common/enums/action.enum';
import { Resource } from '../common/enums/resource.enum';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('merchant/pages')
@UseGuards(MerchantGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @Permissions(Resource.PAGES, Action.CREATE)
  async createPage(@Req() req, @Body() dto: CreatePageDto) {
    return this.pagesService.createPage(dto, req.user.id);
  }

  @Get()
  @Permissions(Resource.PAGES, Action.READ)
  async getPages(@Req() req) {
    return this.pagesService.getPages(req.user.id);
  }

  @Get('home-page')
  @Permissions(Resource.PAGES, Action.READ)
  async getOrCreateHomePage(@Req() req) {
    return this.pagesService.getOrCreateHomePage(req.activeStore.id);
  }

  @Get(':id')
  @Permissions(Resource.PAGES, Action.READ)
  async getPage(@Req() req, @Param('id') id: string) {
    return this.pagesService.getPage(id, req.activeStore.id);
  }

  @Patch(':id')
  @Permissions(Resource.PAGES, Action.UPDATE)
  async updatePage(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.updatePage(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @Permissions(Resource.PAGES, Action.UPDATE)
  async updatePageStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdatePageStatusDto,
  ) {
    return this.pagesService.updatePageStatus(id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Resource.PAGES, Action.DELETE)
  async deletePage(@Req() req, @Param('id') id: string) {
    return this.pagesService.deletePage(id, req.user.id);
  }
}
