import { IsEnum } from 'class-validator';
import { PageStatus } from '@prisma/client';

export class UpdatePageStatusDto {
  @IsEnum(PageStatus)
  status: PageStatus;
}
