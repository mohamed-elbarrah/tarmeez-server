import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { MerchantService } from './merchant.service';
import { MerchantGuard } from './guards/merchant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateStoreDto } from './dto/update-store.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { PaymentRegistry } from '../payments/payment.registry';
import { OrdersService } from '../orders/orders.service';
import { IsNotEmpty, IsString } from 'class-validator';
import { Action } from '../common/enums/action.enum';
import { Resource } from '../common/enums/resource.enum';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UploadService } from '../utils/upload.service';


type JwtUser = { id: string; email?: string; role?: string };

class SwitchThemeDto {
  @IsString()
  @IsNotEmpty()
  themeId!: string;
}

@UseGuards(MerchantGuard)
@Controller('merchant')
export class MerchantController {
  constructor(
    private svc: MerchantService,
    private registry: PaymentRegistry,
    private ordersSvc: OrdersService,
    private uploadService: UploadService,
  ) {}

  @Get('customers')
  @Permissions(Resource.CUSTOMERS, Action.READ)
  async getCustomers(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const params = {
      search,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as any;
    return this.svc.getCustomers(user.id, params);
  }

  @Patch('customers/:id/status')
  @Permissions(Resource.CUSTOMERS, Action.UPDATE)
  async updateCustomerStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'BANNED' },
  ) {
    const { status } = body;
    return this.svc.updateCustomerStatus(user.id, id, status);
  }

  @Get('me')
  @Permissions(Resource.SETTINGS, Action.READ)
  async getMyStore(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.svc.getMyStore(user.id, req.activeStore.id);
  }

  @Patch('store/customization')
  @Permissions(Resource.SETTINGS, Action.UPDATE)
  async updateStoreCustomization(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.svc.updateStoreCustomization(user.id, dto);
  }

  @Get('settings')
  @Permissions(Resource.SETTINGS, Action.READ)
  async getSettings(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.svc.getSettings(user.id, req.activeStore.id);
  }

  @Patch('settings')
  @Permissions(Resource.SETTINGS, Action.UPDATE)
  async updateSettings(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.svc.updateSettings(user.id, req.activeStore.id, dto);
  }

  @Post('store/upload-image')
  @Permissions(Resource.SETTINGS, Action.UPDATE)
  @UseInterceptors(FileInterceptor('file', UploadService.getMulterOptions()))
  async uploadStoreImage(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    
    // Store assets under stores/{storeId}/images/
    const storeId = req.activeStore?.id;
    if (!storeId) throw new BadRequestException('Active store not found');
    const keyPath = `stores/${storeId}/images`;

    const url = await this.uploadService.uploadFile(file, keyPath);
    return { url };
  }


  @Get('store/payment-methods')
  @Permissions(Resource.SETTINGS, Action.READ)
  async getPaymentMethods(@CurrentUser() user: JwtUser) {
    return this.svc.getPaymentSettings(user.id, this.registry);
  }

  @Patch('store/payment-methods')
  @Permissions(Resource.SETTINGS, Action.UPDATE)
  async updatePaymentMethods(
    @CurrentUser() user: JwtUser,
    @Body() body: { enabledMethods: string[] },
  ) {
    // validate keys exist
    const available = this.registry.getAll().map((g) => (g as any).key);
    for (const k of body.enabledMethods) {
      if (!available.includes(k))
        throw new BadRequestException(`Payment gateway ${k} not found`);
    }
    return this.svc.updatePaymentSettings(user.id, body.enabledMethods);
  }

  @Patch('store/theme')
  @Permissions(Resource.SETTINGS, Action.UPDATE)
  async switchTheme(@CurrentUser() user: JwtUser, @Body() dto: SwitchThemeDto) {
    return this.svc.switchTheme(user.id, dto.themeId);
  }

  @Get('orders')
  @Permissions(Resource.ORDERS, Action.READ)
  async getOrders(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.svc.getOrders(user.id, {
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    });
  }

  @Get('orders/:orderCode')
  @Permissions(Resource.ORDERS, Action.READ)
  async getOrderDetail(
    @CurrentUser() user: JwtUser,
    @Param('orderCode') orderCode: string,
  ) {
    return this.svc.getOrderByCode(user.id, orderCode);
  }

  @Patch('orders/:orderCode/status')
  @Permissions(Resource.ORDERS, Action.UPDATE)
  async updateOrderStatus(
    @CurrentUser() user: JwtUser,
    @Param('orderCode') orderCode: string,
    @Body() body: { status: any },
  ) {
    return this.svc.updateOrderStatus(user.id, orderCode, body.status);
  }
}

