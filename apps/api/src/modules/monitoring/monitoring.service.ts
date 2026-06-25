import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import type { ActionType } from '@gestao-prime/shared';

export interface ActivityLogRow {
  id: string;
  user_id: number;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string;
  description: string;
  ip: string;
  created_at: Date;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private prisma: PrismaService,
    private tenantDb: TenantDbService,
  ) {}

  async log(data: {
    tenantId: string;
    userId: string;
    action: ActionType;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  private parseSettings(settings: string | null): Record<string, unknown> {
    try { return JSON.parse(settings || '{}'); } catch { return {}; }
  }

  async findByTenant(tenantId: string, page = 1, limit = 50, from?: string, to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { logs: [], total: 0, page, totalPages: 0 };

    const settings = this.parseSettings(tenant.settings);
    const railwayDbUrl = settings?.railwayDatabaseUrl as string;

    if (!railwayDbUrl || !railwayDbUrl.startsWith('postgresql')) {
      return { logs: [], total: 0, page, totalPages: 0 };
    }

    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (from) {
        conditions.push(`created_at AT TIME ZONE 'America/Sao_Paulo' >= $${paramIndex}::date`);
        params.push(from);
        paramIndex++;
      }
      if (to) {
        conditions.push(`created_at AT TIME ZONE 'America/Sao_Paulo' < ($${paramIndex}::date + INTERVAL '1 day')`);
        params.push(to);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await this.tenantDb.runQuery(
        tenantId,
        railwayDbUrl,
        `SELECT COUNT(*) as total FROM "activity_log" ${whereClause}`,
        params,
      );
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      const logsResult = await this.tenantDb.runQuery(
        tenantId,
        railwayDbUrl,
        `SELECT id, user_id, user_name, action, entity, entity_id, description, ip, created_at
         FROM "activity_log"
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
      );

      const logs: ActivityLogRow[] = logsResult.rows;

      return {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar activity_log para tenant ${tenantId}: ${error.message}`);
      return { logs: [], total: 0, page, totalPages: 0 };
    }
  }

  async getDashboardStats() {
    const [totalTenants, totalUsers, activeSubscriptions] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count({ where: { role: { not: 'super_admin' } } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
    ]);

    return { totalTenants, totalUsers, activeSubscriptions };
  }

  async exportLogs(tenantId: string, from?: string, to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { tenantName: '', logs: [] };

    const settings = this.parseSettings(tenant.settings);
    const railwayDbUrl = settings?.railwayDatabaseUrl as string;

    if (!railwayDbUrl || !railwayDbUrl.startsWith('postgresql')) {
      return { tenantName: tenant.name, logs: [] };
    }

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (from) {
        conditions.push(`created_at AT TIME ZONE 'America/Sao_Paulo' >= $${paramIndex}::date`);
        params.push(from);
        paramIndex++;
      }
      if (to) {
        conditions.push(`created_at AT TIME ZONE 'America/Sao_Paulo' < ($${paramIndex}::date + INTERVAL '1 day')`);
        params.push(to);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const logsResult = await this.tenantDb.runQuery(
        tenantId,
        railwayDbUrl,
        `SELECT id, user_id, user_name, action, entity, entity_id, description, ip, created_at
         FROM "activity_log"
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      );

      return { tenantName: tenant.name, logs: logsResult.rows };
    } catch (error) {
      this.logger.error(`Erro ao exportar activity_log para tenant ${tenantId}: ${error.message}`);
      return { tenantName: tenant.name, logs: [] };
    }
  }
}
