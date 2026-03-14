import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { CustomerGuard } from './guards/customer.guard';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({}),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtAccessStrategy,
        JwtRefreshStrategy,
        CustomerGuard,
    ],
    exports: [AuthService, CustomerGuard, JwtModule],
})
export class AuthModule { }
