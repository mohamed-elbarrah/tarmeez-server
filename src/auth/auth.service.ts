import {
    Injectable,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { MerchantRegisterDto } from './dto/merchant-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { UserRole, MerchantStatus } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async platformLogin(dto: PlatformLoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { merchant: true },
        });

        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

        if (user.role === UserRole.CUSTOMER) {
            throw new ForbiddenException('Invalid portal for this user type');
        }

        if (user.role === UserRole.MERCHANT) {
            if (user.merchant?.status === MerchantStatus.PENDING) {
                throw new ForbiddenException('PENDING');
            }
            if (user.merchant?.status === MerchantStatus.REJECTED) {
                throw new ForbiddenException('REJECTED');
            }
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async merchantRegister(dto: MerchantRegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) throw new ConflictException('Email already registered');

        const existingStore = await this.prisma.merchant.findUnique({
            where: { storeName: dto.storeName },
        });
        if (existingStore) throw new ConflictException('Store name already taken');

        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const storeSlug = dto.storeName.toLowerCase().replace(/ /g, '-');

        await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: dto.email,
                    password: hashedPassword,
                    role: UserRole.MERCHANT,
                },
            });

            await tx.merchant.create({
                data: {
                    userId: user.id,
                    fullName: dto.fullName,
                    phone: dto.phone,
                    storeName: dto.storeName,
                    storeSlug,
                    category: dto.category,
                    country: dto.country,
                    city: dto.city,
                    description: dto.description,
                    status: MerchantStatus.PENDING,
                },
            });
        });

        return { message: 'Application submitted successfully' };
    }

    async customerLogin(dto: CustomerLoginDto) {
        const store = await this.prisma.store.findUnique({
            where: { slug: dto.storeSlug },
        });
        if (!store) throw new NotFoundException('Store not found');

        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { customers: true },
        });

        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

        const isCustomerOfStore = user.customers.some((c) => c.storeId === store.id);
        if (!isCustomerOfStore) {
            throw new ForbiddenException('User is not a customer of this store');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async customerRegister(dto: CustomerRegisterDto) {
        const merchant = await this.prisma.merchant.findUnique({
            where: { storeSlug: dto.storeSlug },
            include: { store: true },
        });
        if (!merchant || !merchant.store) throw new NotFoundException('Store not found');

        const existingCustomer = await this.prisma.user.findFirst({
            where: {
                email: dto.email,
                customers: { some: { storeId: merchant.store.id } },
            },
        });
        if (existingCustomer) throw new ConflictException('Email already registered for this store');

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({ where: { email: dto.email } });

            if (!user) {
                user = await tx.user.create({
                    data: {
                        email: dto.email,
                        password: hashedPassword,
                        role: UserRole.CUSTOMER,
                    },
                });
            }

            await tx.customer.create({
                data: {
                    userId: user.id,
                    storeId: merchant.store!.id,
                    fullName: dto.fullName,
                    phone: dto.phone,
                },
            });

            return user;
        });

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshToken) throw new ForbiddenException('Access Denied');

        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async logout(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

    private async updateRefreshToken(userId: string, refreshToken: string) {
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hashedRefreshToken },
        });
    }

    private async generateTokens(userId: string, email: string, role: UserRole) {
        const payload = { sub: userId, email, role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
                expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') as any,
            }),
        ]);

        return { accessToken, refreshToken };
    }

    setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
        res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000, // 15m
        });
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });
    }

    clearTokenCookies(res: Response) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
    }
}
