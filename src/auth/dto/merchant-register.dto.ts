import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class MerchantRegisterDto {
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @IsNotEmpty()
    storeName: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    @IsString()
    @IsNotEmpty()
    country: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsOptional()
    description?: string;
}
