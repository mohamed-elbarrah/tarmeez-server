import { StoreRole } from '@prisma/client';

/**
 * Represents the active store context resolved by MerchantGuard.
 * Attached to the request object as `req.activeStore`.
 */
export interface ActiveStore {
  /** The UUID of the store the authenticated user belongs to. */
  id: string;
  /** The user's role within this store. */
  role: StoreRole;
}
