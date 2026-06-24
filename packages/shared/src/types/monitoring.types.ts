export type ActionType = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'export' | 'payment';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: ActionType;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
