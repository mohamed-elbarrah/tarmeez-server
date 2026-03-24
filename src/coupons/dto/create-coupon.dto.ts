import { Transform, Type } from 'class-transformer'
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsInt,
  IsArray, IsDateString, Min, Max,
} from 'class-validator'

export enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
  FREE_PRODUCT = 'FREE_PRODUCT',
  PRODUCT_DISCOUNT = 'PRODUCT_DISCOUNT',
}

export class CreateCouponDto {
  @IsString() @IsNotEmpty()
  name: string

  @IsString() @IsNotEmpty()
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string

  @IsOptional() @IsString()
  description?: string

  @IsEnum(CouponType)
  type: CouponType

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  discountValue?: number

  @IsOptional() @IsNumber() @Min(0)
  maxDiscountAmount?: number

  @IsOptional() @IsString()
  freeProductId?: string

  @IsOptional() @IsInt() @Min(1)
  freeProductQty?: number

  @IsOptional() @IsArray()
  applicableProductIds?: string[]

  @IsOptional() @IsArray()
  applicableCategoryIds?: string[]

  @IsOptional() @IsNumber() @Min(0)
  minOrderAmount?: number

  @IsOptional() @IsInt() @Min(1)
  maxUsageCount?: number

  @IsOptional() @IsInt() @Min(1)
  perCustomerLimit?: number

  @IsOptional() @IsArray()
  customerIds?: string[]

  @IsOptional() @IsDateString()
  startsAt?: string

  @IsOptional() @IsDateString()
  expiresAt?: string
}
