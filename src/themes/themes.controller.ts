import { Controller, Get } from '@nestjs/common';
import { ThemesService } from './themes.service';

/**
 * GET /themes  — Public endpoint; no auth required.
 * Returns the list of all active themes so the merchant UI
 * and any future storefront theme-picker can consume it.
 */
@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  findAll() {
    return this.themesService.findAll();
  }
}
