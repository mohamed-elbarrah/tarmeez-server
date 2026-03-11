import { Type } from 'class-transformer'
import { IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

class ShippingAddressDto {
  @IsString() @IsNotEmpty() fullName: string
  @IsString() @IsNotEmpty() phone: string
  @IsString() @IsNotEmpty() city: string
  @IsString() @IsNotEmpty() region: string
  @IsString() @IsNotEmpty() street: string
  @IsOptional() @IsString() buildingNo?: string
}

class OrderItemDto {
  @IsString() productId: string
  @IsInt() @Min(1) quantity: number
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() customerName: string
  @IsOptional() @IsEmail() customerEmail?: string
  @IsString() @IsNotEmpty() customerPhone: string
  @ValidateNested() @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto
  @IsString() paymentMethod: string
  @IsArray() @ValidateNested({ each: true })
  @Type(() => OrderItemDto) items: OrderItemDto[]
  @IsOptional() @IsString() notes?: string
  @IsString() storeSlug: string
}
