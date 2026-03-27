import {
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class SocialLinkDto {
  @IsString()
  platform!: string;

  @IsString()
  url!: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  logo?: string | null;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  favicon?: string | null;

  @IsEmail()
  @IsOptional()

  @Transform(({ value }) => value === '' ? null : value)
  supportEmail?: string | null;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  supportWhatsapp?: string | null;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsString()
  @IsOptional()
  systemCurrency?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  currencyIcon?: string | null;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  taxNumber?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxPercentage?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isTaxEnabled?: boolean;
}
