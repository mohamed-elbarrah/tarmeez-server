import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsUrl, IsHexColor } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateStoreDto {
    @IsOptional()
    @Transform(({ value }) => value === '' ? undefined : value)
    @IsUrl({ require_tld: false })
    logo?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(40)
    @Max(300)
    logoWidth?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(20)
    @Max(120)
    logoHeight?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    showStoreName?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === '' ? undefined : value)
    @IsUrl({ require_tld: false })
    favicon?: string;

    @IsOptional()
    @IsHexColor()
    primaryColor?: string;

    @IsOptional()
    @IsHexColor()
    secondaryColor?: string;

    @IsOptional()
    @IsHexColor()
    accentColor?: string;

    @IsOptional()
    @IsString()
    storeName?: string;

    @IsOptional()
    @IsString()
    textColor?: string;

    @IsOptional()
    @IsString()
    headingColor?: string;

    @IsOptional()
    @IsString()
    buttonColor?: string;

    @IsOptional()
    @IsString()
    fontFamily?: string;

    @IsOptional()
    @IsString()
    borderRadius?: string;
}
