import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PagesModule } from '../pages/pages.module';

@Module({
    imports: [PrismaModule, PagesModule],
    controllers: [StoresController],
    providers: [StoresService],
    exports: [StoresService],
})
export class StoresModule { }
