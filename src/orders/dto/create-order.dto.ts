import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ShippingAddressDto {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() building?: string;
}

class OrderItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() customerName: string;
  @IsOptional() @IsEmail() customerEmail?: string;
  @IsString() @IsNotEmpty() customerPhone: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
  @IsString() paymentMethod: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsOptional() @IsString() notes?: string;
  @IsString() storeSlug: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsObject() customFields?: Record<string, any>;
}
