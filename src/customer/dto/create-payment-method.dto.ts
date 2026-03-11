import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  last4: string;

  @IsInt()
  @Min(1)
  expiryMonth: number;

  @IsInt()
  expiryYear: number;

  @IsString()
  @IsNotEmpty()
  holderName: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
