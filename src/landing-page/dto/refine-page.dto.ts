import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type RefineScope = 'full' | 'section' | 'field';

export class ConversationMessageDto {
  @IsEnum(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class RefinePageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  instruction: string;

  @IsEnum(['full', 'section', 'field'])
  scope: RefineScope;

  /** Required when scope = 'section' or 'field' */
  @IsOptional()
  @IsString()
  sectionType?: string;

  /** Required when scope = 'field' */
  @IsOptional()
  @IsString()
  fieldPath?: string;

  /** The current full page content — sent from client so we never do a DB read just to get content */
  @IsObject()
  currentContent: Record<string, any>;

  /** Conversation history for context (last 6 messages max) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  conversationHistory?: ConversationMessageDto[];
}
