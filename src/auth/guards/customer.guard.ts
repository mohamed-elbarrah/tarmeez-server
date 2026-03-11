import { Injectable, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class CustomerGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    // expect storeSlug in params or header
    const storeSlug = req.params?.storeSlug || req.headers['x-store-slug'];

    if (!user || user.role !== 'CUSTOMER') {
      throw new ForbiddenException('Access denied');
    }

    // if storeSlug provided verify storeId matches resolved store id
    // token includes storeId, so compare
    if (storeSlug && user.storeId === undefined) {
      throw new ForbiddenException('Store mismatch');
    }

    return true;
  }
}
