import {
  Injectable,
  Logger,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { StoreRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveStore } from '../../common/types/active-store.interface';

@Injectable()
export class MerchantGuard extends JwtAuthGuard {
  private readonly logger = new Logger(MerchantGuard.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Validate the JWT — populates req.user via PassportStrategy
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;

    if (!user || user.role !== 'MERCHANT') {
      throw new ForbiddenException('Access denied');
    }

    this.logger.debug(`Guard Debug — User ID: ${user.id}, role: ${user.role}`);

    // 2. Resolve the active store from StoreMember — single source of truth.
    //    This works for both the store OWNER and invited team members.
    const memberships = await this.prisma.storeMember.findMany({
      where: { userId: user.id },
      select: { storeId: true, role: true },
    });

    this.logger.debug(
      `Guard Debug — Found ${memberships.length} membership(s) for user ${user.id}`,
    );

    if (memberships.length === 0) {
      throw new ForbiddenException(
        'No store associated with this account. Please complete your store setup.',
      );
    }

    // Prioritise OWNER over other roles when the user belongs to multiple stores
    const membership =
      memberships.find((m) => m.role === StoreRole.OWNER) ?? memberships[0];
    const active: ActiveStore = {
      id: membership.storeId,
      role: membership.role,
    };

    req.activeStore = active;
    return true;
  }
}
