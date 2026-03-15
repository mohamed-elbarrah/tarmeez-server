import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { PageType } from '@prisma/client';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsEnum(PageType)
  type: PageType;

  @IsOptional()
  @IsString()
  linkedProductId?: string;

  @IsOptional()
  @IsBoolean()
  showHeader?: boolean;

  @IsOptional()
  @IsBoolean()
  showFooter?: boolean;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  content?: any;
}
