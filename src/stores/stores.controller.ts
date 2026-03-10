import { Controller, Get, Param } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
    constructor(private readonly storesService: StoresService) { }

    @Get(':slug')
    async getStoreBySlug(@Param('slug') slug: string) {
        return this.storesService.getStoreBySlug(slug);
    }
}
