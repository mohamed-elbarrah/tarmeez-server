import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantModule } from '../merchant/merchant.module';

@Module({
  imports: [PrismaModule, MerchantModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
