import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CustomerLoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    storeSlug: string;
}
