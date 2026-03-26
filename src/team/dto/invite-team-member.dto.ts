import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { StoreRole } from '@prisma/client';

export class InviteTeamMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(StoreRole)
  role: StoreRole;
}
