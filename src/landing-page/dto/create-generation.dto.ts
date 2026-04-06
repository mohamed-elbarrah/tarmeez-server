import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsUUID,
} from 'class-validator';

export enum GenerationTone {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  LUXURIOUS = 'luxurious',
  PLAYFUL = 'playful',
  URGENT = 'urgent',
}

export enum GenerationLanguage {
  AR = 'ar',
  EN = 'en',
}

export class CreateGenerationDto {
  @IsString()
  @MaxLength(2000)
  prompt: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(GenerationLanguage)
  language?: GenerationLanguage = GenerationLanguage.AR;

  @IsOptional()
  @IsEnum(GenerationTone)
  tone?: GenerationTone = GenerationTone.PROFESSIONAL;
}
