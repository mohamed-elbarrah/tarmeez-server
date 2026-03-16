import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsNumber,
} from 'class-validator'

export class CollectEventDto {
  @IsString()
  @IsNotEmpty()
  storeRef: string  // accepts both storeId UUID and storeSlug

  @IsString()
  @IsNotEmpty()
  sessionId: string

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'pageview',
    'click',
    'move',
    'scroll',
    'cart_add',
    'cart_abandon',
    'checkout_start',
    'product_view',
  ])
  type: string

  @IsString()
  @IsNotEmpty()
  page: string

  @IsOptional()
  @IsString()
  referrer?: string

  @IsOptional()
  @IsString()
  device?: string

  @IsOptional()
  @IsString()
  browser?: string

  @IsOptional()
  @IsNumber()
  x?: number

  @IsOptional()
  @IsNumber()
  y?: number

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsOptional()
  @IsNumber()
  depth?: number

  @IsOptional()
  metadata?: Record<string, any>

  @IsNumber()
  ts: number
}
