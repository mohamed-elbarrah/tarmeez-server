import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, Min } from 'class-validator'

export class ValidateCouponDto {
  @IsString() @IsNotEmpty()
  code: string

  @IsString() @IsNotEmpty()
  storeId: string

  @IsNumber() @Min(0)
  orderTotal: number

  @IsOptional() @IsString()
  customerId?: string

  @IsOptional() @IsArray()
  productIds?: string[]
}
