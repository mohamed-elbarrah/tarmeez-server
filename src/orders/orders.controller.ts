import { Controller, Post, Body, Get, Query, Param, UseGuards, Req } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { ThrottlerGuard } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    let userId: string | undefined
    try {
      const token = (req as any).cookies?.customer_access_token || (req as any).cookies?.access_token
      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        })
        userId = payload.sub
      }
    } catch {
      userId = undefined
    }

    const order = await this.orders.createOrder(dto, userId)

    return {
      orderCode: order.orderCode,
      orderId: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      createdAt: order.createdAt,
      estimatedDelivery: '3-5 أيام عمل',
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        price: Number(item.price),
        quantity: item.quantity,
        total: Number(item.total),
      })),
      shippingAddress: {
        city: order.shippingCity,
        region: order.shippingRegion,
        street: order.shippingStreet,
        building: order.shippingBuilding,
      }
    }
  }

  @Get(':orderCode')
  async get(@Param('orderCode') orderCode: string, @Query('storeSlug') storeSlug: string) {
    const order = await this.orders.getOrderByCode(orderCode, storeSlug)

    return {
      orderCode: order.orderCode,
      orderId: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      createdAt: order.createdAt,
      estimatedDelivery: '3-5 أيام عمل',
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        price: Number(item.price),
        quantity: item.quantity,
        total: Number(item.total),
      })),
      shippingAddress: {
        city: order.shippingCity,
        region: order.shippingRegion,
        street: order.shippingStreet,
        building: order.shippingBuilding,
      }
    }
  }
}
