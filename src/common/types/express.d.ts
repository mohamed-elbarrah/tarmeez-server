import { ActiveStore } from './active-store.interface';

/**
 * Augments the Express Request type so that `req.activeStore` and
 * `req.user` are typed throughout the application.
 *
 * This file is auto-included by TypeScript because it lives inside the
 * `src/` tree and uses `declare global` — no `typeRoots` change needed.
 */
declare global {
  namespace Express {
    interface Request {
      /** JWT-validated user payload set by JwtAuthGuard / PassportStrategy. */
      user: {
        id: string;
        email: string;
        role: string;
        storeId: string | null;
      };

      /**
       * Active store context resolved by MerchantGuard.
       * Guaranteed to be present on all routes guarded by MerchantGuard.
       */
      activeStore: ActiveStore;
    }
  }
}

export {};
