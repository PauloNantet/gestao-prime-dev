export enum EntityStatus {
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
  status: EntityStatus;
  databaseUrl: string;
  databaseName: string;
  settings: Record<string, unknown>;
  additionalDays: number;
  products?: { id: string; name: string; icon: string | null }[];
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
  planId?: string;
  status?: string;
  settings?: Record<string, unknown>;
  additionalDays?: number;
}

export interface UpdateTenantDto {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  status?: EntityStatus;
  planId?: string;
  settings?: Record<string, unknown>;
  additionalDays?: number;
}
