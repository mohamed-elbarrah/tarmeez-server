import { Injectable, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Injectable()
export class MerchantGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
