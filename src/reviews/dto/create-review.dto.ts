import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt() 
  @Min(1) 
  @Max(5)
  rating: number;

  @IsOptional() 
  @IsString() 
  @MaxLength(500)
  comment?: string;

  @IsString() 
  @IsNotEmpty()
  productId: string;

  @IsString() 
  @IsNotEmpty()
  storeSlug: string;
}
