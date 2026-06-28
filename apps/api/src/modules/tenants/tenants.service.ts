import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { SubscriptionDbService } from '../../common/database/subscription-db.service';
import { slugify, generateDatabaseName, calculateEndDate } from '@gestao-prime/shared';
import type { CreateTenantDto, UpdateTenantDto } from '@gestao-prime/shared';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private tenantDb: TenantDbService,
    private subscriptionDb: SubscriptionDbService,
  ) {}

  private parseSettings(settings: string): Record<string, unknown> {
    try { return JSON.parse(settings); } catch { return {}; }
  }

  private formatTenant(t: any) {
    return { ...t, settings: this.parseSettings(t.settings) };
  }

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const result = [];
    for (const t of tenants) {
      const sub = await this.subscriptionDb.findByTenant(t.id);
      const product = sub ? { id: sub.planId, planName: sub.planName } : null;
      result.push(this.formatTenant({ ...t, subscription: sub, products: product ? [product] : [] }));
    }

    return result;
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const sub = await this.subscriptionDb.findByTenant(id);
    const product = sub ? { id: sub.planId, planName: sub.planName } : null;
    return this.formatTenant({ ...tenant, subscription: sub, products: product ? [product] : [] });
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const slug = slugify(dto.slug);

    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) throw new ConflictException('Slug já está em uso');

    const databaseName = generateDatabaseName(slug);
    const settings = dto.settings || {};
    const railwayDbUrl = (settings as Record<string, string>)['railwayDatabaseUrl'];
    const tenantDbUrl = railwayDbUrl || dto.databaseUrl || process.env.MASTER_DATABASE_URL || '';
    const masterFallbackUrl = process.env.MASTER_DATABASE_URL || '';

    console.log('[TenantsService.create] slug:', slug, 'databaseName:', databaseName, 'railwayDbUrl:', railwayDbUrl?.slice(0, 40) + '...', 'planId:', dto.planId);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        databaseUrl: tenantDbUrl,
        databaseName,
        status: (dto.status as any) || 'trial',
        settings: JSON.stringify(settings),
      },
    });

    console.log('[TenantsService.create] tenant created:', tenant.id, 'databaseName:', tenant.databaseName);

    const dbUrlForMigrations = railwayDbUrl || masterFallbackUrl;
    if (dbUrlForMigrations && dbUrlForMigrations.startsWith('postgresql')) {
      await this.tenantDb.runMigrations(tenant.id, dbUrlForMigrations, databaseName);
    }

    if (dto.planId) {
      await this.subscriptionDb.assignPlan(tenant.id, dto.planId);
    } else {
      await this.subscriptionDb.createTrial(tenant.id);
    }

    await this.subscriptionDb.syncTenantToClientDb(tenant.id);

    return this.findById(tenant.id);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findById(id);
    const { settings, planId, status, additionalDays, ...rest } = dto;

    const data: any = { ...rest };
    if (settings) data.settings = JSON.stringify(settings);

    if (status) {
      data.status = status;
      await this.subscriptionDb.updateStatus(id, status);
    }

    if (planId) {
      try {
        await this.subscriptionDb.assignPlan(id, planId);
      } catch (e) {
        console.warn('[TenantsService] Erro ao atualizar subscription no tenant DB:', e.message);
      }
    } else if (additionalDays !== undefined) {
      const sub = await this.subscriptionDb.findByTenant(id);
      if (sub) {
        const endsAt = calculateEndDate(new Date(), sub.planValidityDays + additionalDays);
        const tenant = await this.prisma.tenant.findUnique({ where: { id } });
        if (tenant) {
          const dbUrl = this.getDatabaseUrl(tenant);
          const settings = this.parseSettings(tenant.settings);
          const schema = (settings?.railwayDatabaseUrl as string) ? 'public' : (tenant.databaseName || `tenant_${tenant.id.replace(/-/g, '_').slice(0, 20)}`);
          try {
            await this.tenantDb.runQuery(
              id, dbUrl,
              `UPDATE "${schema}".subscription SET ends_at = $1, updated_at = NOW()`,
              [endsAt.toISOString()],
            );
          } catch (e) {
            console.warn('[TenantsService] Erro ao estender subscription:', e.message);
          }
        }
      }
    }

    const updated = await this.prisma.tenant.update({ where: { id }, data });
    await this.subscriptionDb.syncTenantToClientDb(id);
    return updated;
  }

  async remove(id: string) {
    await this.findById(id);

    await this.subscriptionDb.removeByTenant(id);

    await this.prisma.auditLog.deleteMany({ where: { tenantId: id } });
    await this.prisma.deployment.deleteMany({ where: { tenantId: id } });
    await this.prisma.invoice.deleteMany({ where: { tenantId: id } });
    await this.prisma.user.deleteMany({ where: { tenantId: id } });

    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Tenant removido com sucesso' };
  }

  private getDatabaseUrl(tenant: any): string {
    const settings = this.parseSettings(tenant.settings);
    return (settings?.railwayDatabaseUrl as string) || tenant.databaseUrl;
  }
}
