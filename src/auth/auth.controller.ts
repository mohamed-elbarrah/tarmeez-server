import {
    Controller,
    Post,
    Body,
    Res,
    UseGuards,
    Get,
    Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import * as PlatformLogin from './dto/platform-login.dto';
import * as MerchantRegister from './dto/merchant-register.dto';
import * as CustomerLogin from './dto/customer-login.dto';
import * as CustomerRegister from './dto/customer-register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('platform/login')
    async platformLogin(
        @Body() dto: PlatformLogin.PlatformLoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.platformLogin(dto);
        this.authService.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: 'Login successful' };
    }

    @Post('platform/register')
    async merchantRegister(@Body() dto: MerchantRegister.MerchantRegisterDto) {
        return this.authService.merchantRegister(dto);
    }

    @Post('customer/login')
    async customerLogin(
        @Body() dto: CustomerLogin.CustomerLoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.customerLogin(dto);
        this.authService.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: 'Login successful' };
    }

    @Post('customer/register')
    async customerRegister(
        @Body() dto: CustomerRegister.CustomerRegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.customerRegister(dto);
        this.authService.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: 'Registration successful' };
    }

    @UseGuards(JwtRefreshGuard)
    @Post('refresh')
    async refresh(
        @CurrentUser() user: any,
        @Res({ passthrough: true }) res: Response,
    ) {
        const tokens = await this.authService.refreshTokens(user.id, user.refreshToken);
        this.authService.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: 'Token refreshed' };
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(
        @CurrentUser() user: any,
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.authService.logout(user.id);
        this.authService.clearTokenCookies(res);
        return { message: 'Logged out' };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@CurrentUser() user: any) {
        return user;
    }
}
