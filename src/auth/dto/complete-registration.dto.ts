import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CompleteRegistrationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @MinLength(8)
  password: string;
}
