import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdatePageStatusDto } from './dto/update-page-status.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';

@Controller('merchant/pages')
@UseGuards(MerchantGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  async createPage(@Req() req, @Body() dto: CreatePageDto) {
    return this.pagesService.createPage(dto, req.user.id);
  }

  @Get()
  async getPages(@Req() req) {
    return this.pagesService.getPages(req.user.id);
  }

  @Get(':id')
  async getPage(@Req() req, @Param('id') id: string) {
    return this.pagesService.getPage(id, req.user.id);
  }

  @Patch(':id')
  async updatePage(@Req() req, @Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.pagesService.updatePage(id, dto, req.user.id);
  }

  @Patch(':id/status')
  async updatePageStatus(@Req() req, @Param('id') id: string, @Body() dto: UpdatePageStatusDto) {
    return this.pagesService.updatePageStatus(id, dto, req.user.id);
  }

  @Delete(':id')
  async deletePage(@Req() req, @Param('id') id: string) {
    return this.pagesService.deletePage(id, req.user.id);
  }
}
