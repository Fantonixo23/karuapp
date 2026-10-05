import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  restauranteId: number | null;
  isSuperadmin: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();
