import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
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
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { UserRole, MerchantStatus, StoreRole } from '@prisma/client';
import { StoreSeedService } from './store-seed.service';
import { generateSlug } from '../utils/slug.util';

export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  merchant?: {
    status: MerchantStatus;
    storeName: string;
    storeSlug: string;
  } | null;
  currentRole?: StoreRole;
}

export interface CustomerAuthResponse {
  id: string;
  email: string;
  role: UserRole;
  storeSlug: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private storeSeedService: StoreSeedService,
  ) {}

  async platformLogin(dto: PlatformLoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, storeId: null },
      include: { merchant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Invalid portal for this user type');
    }

    if (user.role === UserRole.MERCHANT) {
      // Allow merchants with PENDING status to login during development.
      if (user.merchant?.status === MerchantStatus.REJECTED) {
        throw new ForbiddenException('REJECTED');
      }
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      null,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { status: true, storeName: true, storeSlug: true },
    });

    const userResp: AuthUserResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      merchant: merchant
        ? {
            status: merchant.status,
            storeName: merchant.storeName,
            storeSlug: merchant.storeSlug,
          }
        : null,
    };

    // Resolve currentRole in the active store
    const membership = await this.prisma.storeMember.findFirst({
      where: { userId: user.id },
      select: { role: true },
    });
    if (membership) {
      userResp.currentRole = membership.role;
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResp,
    };
  }

  async merchantRegister(dto: MerchantRegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, storeId: null },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const existingStore = await this.prisma.merchant.findUnique({
      where: { storeName: dto.storeName },
    });
    if (existingStore) throw new ConflictException('Store name already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const storeSlug =
      generateSlug(dto.storeName) ||
      dto.storeName.toLowerCase().replace(/\s+/g, '-');

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: UserRole.MERCHANT,
          storeId: null,
        },
      });

      const merchant = await tx.merchant.create({
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

      const store = await tx.store.create({
        data: {
          merchantId: merchant.id,
          slug: storeSlug,
          name: dto.storeName,
        },
      });

      // Atomically register the creator as the store OWNER in StoreMember
      await tx.storeMember.create({
        data: {
          userId: user.id,
          storeId: store.id,
          role: StoreRole.OWNER,
        },
      });

      return { user, merchant, store };
    });

    // Fire-and-forget seed — never awaited in the registration flow
    this.storeSeedService
      .seedStore(result.store.id)
      .catch((err) =>
        console.error('Seed failed for store', result.store.id, err),
      );

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.user.role,
      null,
    );
    await this.updateRefreshToken(result.user.id, tokens.refreshToken);

    const userResp: AuthUserResponse = {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      merchant: {
        status: result.merchant.status,
        storeName: result.merchant.storeName,
        storeSlug: result.merchant.storeSlug,
      },
      currentRole: StoreRole.OWNER,
    };

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Registration successful',
      user: userResp,
    };
  }

  async customerLogin(dto: CustomerLoginDto) {
    const store = await this.prisma.store.findUnique({
      where: { slug: dto.storeSlug },
    });
    if (!store) throw new NotFoundException('Store not found');

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, storeId: store.id },
      include: { customers: true },
    });

    if (!user)
      throw new UnauthorizedException(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );

    // ensure role
    if (user.role !== UserRole.CUSTOMER)
      throw new ForbiddenException('Invalid portal for this user type');

    // check customer record & status
    const customerRecord = await this.prisma.customer.findFirst({
      where: { userId: user.id, storeId: store.id },
    });
    if (!customerRecord)
      throw new ForbiddenException('User is not a customer of this store');
    if (customerRecord.status === 'BANNED')
      throw new ForbiddenException('تم حظر هذا الحساب');

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      store.id,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    const userResp: CustomerAuthResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      storeSlug: store.slug,
    };

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResp,
    };
  }

  async customerRegister(dto: CustomerRegisterDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storeSlug: dto.storeSlug },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');

    const existingCustomer = await this.prisma.user.findFirst({
      where: { email: dto.email, storeId: merchant.store.id },
    });
    if (existingCustomer)
      throw new ConflictException(
        'البريد الإلكتروني مسجل مسبقاً في هذا المتجر',
      );

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      // create a new user tied to this store
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: UserRole.CUSTOMER,
          storeId: merchant.store!.id,
        },
      });

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

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      merchant.store!.id,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    const userResp: CustomerAuthResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      storeSlug: merchant.store!.slug,
    };

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResp,
    };
  }

  /**
   * Completes registration for a user invited via a team invitation link.
   * The invitation must already be in ACCEPTED status (acceptInvitation was called first).
   * Creates the User account + StoreMember in one transaction and issues auth tokens.
   */
  async completeInvitedRegistration(dto: CompleteRegistrationDto) {
    console.log('Registration Attempt - Token:', dto.token);

    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { token: dto.token },
      include: { store: { select: { id: true, name: true, slug: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'ACCEPTED') {
      throw new BadRequestException('Invalid or expired invitation link');
    }

    // Guard against replay — if a user account already exists, they should log in instead
    const existingUser = await this.prisma.user.findFirst({
      where: { email: invitation.email, storeId: null },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists. Please log in.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          name: dto.fullName,
          role: UserRole.MERCHANT,
          storeId: null,
        },
      });

      await tx.storeMember.create({
        data: {
          userId: newUser.id,
          storeId: invitation.storeId,
          role: invitation.role,
        },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      invitation.storeId,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    const userResp: AuthUserResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      merchant: null,
    };

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResp,
      storeName: invitation.store.name,
      storeSlug: invitation.store.slug,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.storeId ?? null,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async getCustomerProfile(userId: string, storeId: string | null) {
    if (!storeId) return null;
    const customer = await this.prisma.customer.findFirst({
      where: { userId, storeId },
    });
    if (!customer) return null;
    return {
      id: customer.id,
      fullName: customer.fullName,
      email: (await this.prisma.user.findUnique({ where: { id: userId } }))
        ?.email,
      phone: customer.phone,
      status: customer.status,
      createdAt: customer.createdAt,
    };
  }

  async findStoreRole(userId: string) {
    return this.prisma.storeMember.findFirst({
      where: { userId },
      select: { role: true },
    });
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

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    storeId: string | null,
  ) {
    const payload = { sub: userId, email, role, storeId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as any,
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

  setCustomerTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    res.cookie('customer_access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15m
    });
    res.cookie('customer_refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });
  }

  clearCustomerTokenCookies(res: Response) {
    res.clearCookie('customer_access_token');
    res.clearCookie('customer_refresh_token');
  }
}
