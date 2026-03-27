import {
  Injectable,
  Logger,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StoreRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY, PermissionMetadata } from '../../common/decorators/permissions.decorator';
import { Action } from '../../common/enums/action.enum';
import { Resource } from '../../common/enums/resource.enum';
import type { ActiveStore } from '../../common/types/active-store.interface';

@Injectable()
export class MerchantGuard extends JwtAuthGuard {
  private readonly logger = new Logger(MerchantGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Validate the JWT — populates req.user via PassportStrategy
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as any;

    if (!user || user.role !== 'MERCHANT') {
      throw new ForbiddenException('Access denied');
    }

    // 2. Resolve the active store from StoreMember — single source of truth.
    const memberships = await this.prisma.storeMember.findMany({
      where: { userId: user.id },
      select: { storeId: true, role: true },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException(
        'No store associated with this account. Please complete your store setup.',
      );
    }

    // Fallback logic: If no specific active store is identified (e.g. from header or session),
    // we use the first one. For more complex apps, this could be stored in session or a header.
    const activeStoreIdFromHeader = req.headers['x-store-id'] as string;
    
    let membership = memberships.find((m) => m.storeId === activeStoreIdFromHeader);
    
    if (!membership) {
        // Fallback to OWNER if available, otherwise first membership
        membership = memberships.find((m) => m.role === StoreRole.OWNER) ?? memberships[0];
    }

    const active: ActiveStore = {
      id: membership.storeId,
      role: membership.role,
    };

    req.activeStore = active;
    
    // Attach currentRole to req.user as requested
    user.currentRole = membership.role;

    // 3. Permission Check
    const permissions = this.reflector.getAllAndOverride<PermissionMetadata>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified, allow if it's a MERCHANT (default behavior)
    if (!permissions) {
      return true;
    }

    const { resource, action } = permissions;
    const role = membership.role;

    // GLOBAL READ POLICY: Grant access to any Action.READ for any role (StoreMember)
    if (action === Action.READ) {
      return true;
    }

    // ADMIN/OWNER: Full access (*)
    if (role === StoreRole.ADMIN || role === StoreRole.OWNER) {
      return true;
    }

    // MARKETER Logic
    if (role === StoreRole.MARKETER) {
      // DENY: TEAM
      if (resource === Resource.TEAM) return false;
      
      // MANAGE: PRODUCTS, CATEGORIES, ORDERS, PAGES, CUSTOMERS, ANALYTICS
      const canManage = [
          Resource.PRODUCTS, 
          Resource.CATEGORIES, 
          Resource.ORDERS, 
          Resource.PAGES, 
          Resource.CUSTOMERS,
          Resource.ANALYTICS
      ].includes(resource);

      if (canManage) return true;
      
      // Default: Action.READ was already handled, so other actions are denied for non-MANAGE resources
      return false;
    }

    // EDITOR Logic
    if (role === StoreRole.EDITOR) {
      // DENY: SETTINGS, TEAM
      if (resource === Resource.SETTINGS || resource === Resource.TEAM) return false;

      // MANAGE: PRODUCTS, CATEGORIES, ORDERS
      const canManage = [
          Resource.PRODUCTS, 
          Resource.CATEGORIES, 
          Resource.ORDERS
      ].includes(resource);

      if (canManage) return true;

      // Default: Action.READ was already handled, so other actions are denied for non-MANAGE resources
      return false;
    }


    return false;
  }
}


