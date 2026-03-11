import { Controller, Post, Body, Get, Query, Param, UseGuards } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { ThrottlerGuard } from '@nestjs/throttler'

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @UseGuards(ThrottlerGuard)
  @Post()
  async create(@Body() dto: CreateOrderDto) {
    return this.orders.createOrder(dto)
  }

  @Get(':orderCode')
  async get(@Param('orderCode') orderCode: string, @Query('storeSlug') storeSlug: string) {
    return this.orders.getOrderByCode(orderCode, storeSlug)
  }
}
