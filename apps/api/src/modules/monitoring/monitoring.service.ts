import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActionType } from '@gestao-prime/shared';

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

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

  async findByTenant(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { tenantId } }),
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getDashboardStats() {
    const [totalTenants, totalUsers, activeSubscriptions, recentLogs] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count({ where: { role: { not: 'super_admin' } } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    return { totalTenants, totalUsers, activeSubscriptions, last24hActions: recentLogs };
  }
}
