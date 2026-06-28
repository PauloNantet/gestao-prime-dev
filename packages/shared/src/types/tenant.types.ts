export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  TRIAL = 'trial',
  PENDING = 'pending',
  OVERDUE = 'overdue',
  ONBOARDING = 'onboarding',
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
  products?: { product: { id: string; name: string; icon: string | null } }[];
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
  status?: string;
  settings?: Record<string, unknown>;
  productIds?: string[];
}

export interface UpdateTenantDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: TenantStatus;
  planId?: string;
  settings?: Record<string, unknown>;
  productIds?: string[];
}
