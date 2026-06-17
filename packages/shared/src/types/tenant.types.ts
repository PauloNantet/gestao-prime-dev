export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  TRIAL = 'trial',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  email: string;
  phone: string | null;
  status: TenantStatus;
  databaseUrl: string;
  databaseName: string;
  subscriptionId: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  document?: string;
  email: string;
  phone?: string;
  databaseUrl?: string;
  planId: string;
}

export interface UpdateTenantDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: TenantStatus;
  settings?: Record<string, unknown>;
}
