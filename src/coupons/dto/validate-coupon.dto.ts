import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  // Accept either storeId (preferred) or storeSlug (fallback from storefront themes)
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  storeSlug?: string;

  @IsNumber()
  @Min(0)
  orderTotal: number;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsArray()
  productIds?: string[];
}
