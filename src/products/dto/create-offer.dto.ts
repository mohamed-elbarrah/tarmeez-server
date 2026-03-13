import { IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsInt()
  @Min(0)
  sortOrder: number;

  @IsBoolean()
  isActive: boolean;
}
