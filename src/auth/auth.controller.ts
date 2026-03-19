import {
    Controller,
    Post,
    Body,
    Res,
    UseGuards,
    Get,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as PlatformLogin from './dto/platform-login.dto';
import * as MerchantRegister from './dto/merchant-register.dto';
import * as CustomerLogin from './dto/customer-login.dto';
import * as CustomerRegister from './dto/customer-register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    @Post('platform/login')
    async platformLogin(
        @Body() dto: PlatformLogin.PlatformLoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.platformLogin(dto);
        this.authService.setTokenCookies(res, result.accessToken, result.refreshToken);
        return { user: result.user };
    }

    @Post('platform/register')
    async merchantRegister(
        @Body() dto: MerchantRegister.MerchantRegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.merchantRegister(dto);
        this.authService.setTokenCookies(res, result.accessToken, result.refreshToken);
        return { message: result.message, user: result.user };
    }

    @Post('customer/login')
    async customerLogin(
        @Body() dto: CustomerLogin.CustomerLoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.customerLogin(dto);
        this.authService.setCustomerTokenCookies(res, result.accessToken, result.refreshToken);
        return { user: result.user };
    }

    @Post('customer/register')
    async customerRegister(
        @Body() dto: CustomerRegister.CustomerRegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.customerRegister(dto);
        this.authService.setCustomerTokenCookies(res, result.accessToken, result.refreshToken);
        return { user: result.user };
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

    @Post('customer/logout')
    async customerLogout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = (req as any).cookies?.customer_access_token;
        if (token) {
            try {
                const payload = this.jwtService.verify(token, {
                    secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
                });
                await this.authService.logout(payload.sub);
            } catch {
                // token invalid, just clear cookies
            }
        }
        this.authService.clearCustomerTokenCookies(res);
        return { message: 'Logged out' };
    }

    @Post('customer/refresh')
    async customerRefresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const refreshToken = (req as any).cookies?.customer_refresh_token;
        if (!refreshToken) throw new UnauthorizedException();

        let payload: any;
        try {
            payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });
        } catch {
            this.authService.clearCustomerTokenCookies(res);
            throw new UnauthorizedException();
        }

        const tokens = await this.authService.refreshTokens(payload.sub, refreshToken);
        this.authService.setCustomerTokenCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: 'Token refreshed' };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@CurrentUser() user: any) {
        if (user?.role === 'CUSTOMER') {
            const profile = await this.authService.getCustomerProfile(user.id, user.storeId ?? null)
            return { ...user, customer: profile }
        }
        return user
    }
}
