import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { LandingPageService } from './landing-page.service';
import { CreateGenerationDto } from './dto';

@Controller('merchant/landing-page')
@UseGuards(MerchantGuard)
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Post('generate')
  async generate(@Req() req, @Body() dto: CreateGenerationDto) {
    return this.landingPageService.createGeneration(req.activeStore.id, dto);
  }

  @Get('generations')
  async listGenerations(@Req() req) {
    return this.landingPageService.listGenerations(req.activeStore.id);
  }

  @Get('generations/:id')
  async getGeneration(@Req() req, @Param('id') id: string) {
    return this.landingPageService.getGeneration(req.activeStore.id, id);
  }

  @Post('generations/:id/retry')
  async retryGeneration(@Req() req, @Param('id') id: string) {
    return this.landingPageService.retryGeneration(req.activeStore.id, id);
  }
}
