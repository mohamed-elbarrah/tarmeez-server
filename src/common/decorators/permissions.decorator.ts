import { SetMetadata } from '@nestjs/common';
import { Action } from '../enums/action.enum';
import { Resource } from '../enums/resource.enum';

export interface PermissionMetadata {
  resource: Resource;
  action: Action;
}

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSIONS_KEY, { resource, action });
