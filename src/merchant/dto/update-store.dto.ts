import { IsString, IsOptional } from 'class-validator';

export class UpdateStoreDto {
    @IsString()
    @IsOptional()
    logo?: string;

    @IsString()
    @IsOptional()
    primaryColor?: string;

    @IsString()
    @IsOptional()
    secondaryColor?: string;

    @IsString()
    @IsOptional()
    fontFamily?: string;
}
