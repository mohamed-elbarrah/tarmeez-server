import { Controller, Get, Patch, Body, UseGuards, Post, UseInterceptors, UploadedFile, BadRequestException, Query, Param } from '@nestjs/common';
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

type JwtUser = { id: string; email?: string; role?: string };

@UseGuards(MerchantGuard)
@Controller('merchant')
export class MerchantController {
  constructor(private svc: MerchantService, private registry: PaymentRegistry, private ordersSvc: OrdersService) { }

  @Get('customers')
  async getCustomers(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const params = { search, status, page: parseInt(page, 10), limit: parseInt(limit, 10) } as any;
    return this.svc.getCustomers(user.id, params);
  }

  @Patch('customers/:id/status')
  async updateCustomerStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'BANNED' },
  ) {
    const { status } = body;
    return this.svc.updateCustomerStatus(user.id, id, status);
  }

  @Get('me')
  async getMyStore(@CurrentUser() user: JwtUser) {
    return this.svc.getMyStore(user.id);
  }

  @Patch('store/customization')
  async updateStoreCustomization(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.svc.updateStoreCustomization(user.id, dto);
  }

  @Post('store/upload-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const user: any = (req as any).user || {};
        const merchantId = user.id || 'unknown';
        const dir = `uploads/stores/${merchantId}`;
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
          // ignore
        }
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/\s+/g, '-');
        cb(null, `${timestamp}-${safeName}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.ico', '.webp'];
      const ext = extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new BadRequestException('Invalid file type'), false as any);
      }
      cb(null, true as any);
    },
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  async uploadStoreImage(@CurrentUser() user: JwtUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const baseUrl = process.env.SERVER_URL ?? 'http://localhost:8000';
    const url = `${baseUrl}/uploads/stores/${user.id}/${file.filename}`;
    return { url };
  }

  @Get('store/payment-methods')
  async getPaymentMethods(@CurrentUser() user: JwtUser) {
    return this.svc.getPaymentSettings(user.id, this.registry)
  }

  @Patch('store/payment-methods')
  async updatePaymentMethods(@CurrentUser() user: JwtUser, @Body() body: { enabledMethods: string[] }) {
    // validate keys exist
    const available = this.registry.getAll().map(g => (g as any).key)
    for (const k of body.enabledMethods) {
      if (!available.includes(k)) throw new BadRequestException(`Payment gateway ${k} not found`)
    }
    return this.svc.updatePaymentSettings(user.id, body.enabledMethods)
  }

  @Get('orders')
  async getOrders(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.svc.getOrders(user.id, { status, page: parseInt(page, 10), limit: parseInt(limit, 10), search })
  }

  @Get('orders/:orderCode')
  async getOrderDetail(@CurrentUser() user: JwtUser, @Param('orderCode') orderCode: string) {
    return this.svc.getOrderByCode(user.id, orderCode)
  }

  @Patch('orders/:orderCode/status')
  async updateOrderStatus(@CurrentUser() user: JwtUser, @Param('orderCode') orderCode: string, @Body() body: { status: any }) {
    return this.svc.updateOrderStatus(user.id, orderCode, body.status)
  }
}
