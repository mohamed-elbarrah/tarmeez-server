import { Injectable, ForbiddenException, UnauthorizedException, ExecutionContext, CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.customer_access_token;

    if (!token) {
      throw new UnauthorizedException('Customer authentication required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      req.user = { id: payload.sub, email: payload.email, role: payload.role, storeId: payload.storeId };
    } catch {
      throw new UnauthorizedException('Invalid or expired customer token');
    }

    if (!req.user || req.user.role !== 'CUSTOMER') {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
