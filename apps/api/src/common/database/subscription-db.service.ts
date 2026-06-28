import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDbService } from './tenant-db.service';
import { calculateEndDate } from '@gestao-prime/shared';
import type { TenantSubscriptionRow } from '@gestao-prime/shared';

@Injectable()
export class SubscriptionDbService {
  private readonly logger = new Logger(SubscriptionDbService.name);

  constructor(
    private prisma: PrismaService,
    private tenantDb: TenantDbService,
  ) {}

  private getDatabaseUrl(tenant: any): string {
    const settings = this.parseSettings(tenant.settings);
    return (settings?.railwayDatabaseUrl as string) || tenant.databaseUrl;
  }

  private parseSettings(settings: string | null): Record<string, unknown> {
    try { return JSON.parse(settings || '{}'); } catch { return {}; }
  }

  private mapRow(row: TenantSubscriptionRow) {
    return {
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      planDailyRate: row.plan_daily_rate,
      planValidityDays: row.plan_validity_days,
      planPrice: row.plan_price,
      planDiscount: row.plan_discount,
      planDiscountedPrice: row.plan_discounted_price,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      cancelledAt: row.cancelled_at,
      validityDays: row.validity_days,
      maxUsers: row.max_users,
      unlimitedUsers: row.unlimited_users,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private schemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '_').slice(0, 20)}`;
  }

  private getSchema(tenant: any): string {
    const settings = this.parseSettings(tenant.settings);
    if (settings?.railwayDatabaseUrl && typeof settings.railwayDatabaseUrl === 'string') {
      return 'public';
    }
    if (tenant.databaseName) return tenant.databaseName;
    return `tenant_${tenant.id.replace(/-/g, '_').slice(0, 20)}`;
  }

  private async ensureSubscriptionSchema(tenantId: string, dbUrl: string, schema: string) {
    const migrationSql = `
      CREATE SCHEMA IF NOT EXISTS "${schema}";

      CREATE TABLE IF NOT EXISTS "${schema}".subscription (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id VARCHAR(255) NOT NULL DEFAULT '',
        plan_name VARCHAR(255),
        plan_daily_rate INTEGER DEFAULT 0,
        plan_validity_days INTEGER DEFAULT 30,
        plan_price INTEGER DEFAULT 0,
        plan_discount INTEGER DEFAULT 0,
        plan_discounted_price INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'trial',
        starts_at TIMESTAMPTZ DEFAULT NOW(),
        ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cancelled_at TIMESTAMPTZ,
        validity_days INTEGER DEFAULT 0,
        max_users INTEGER DEFAULT 1,
        unlimited_users BOOLEAN DEFAULT false,
        tenant_name VARCHAR(255),
        tenant_slug VARCHAR(255),
        tenant_document VARCHAR(20),
        tenant_email VARCHAR(255),
        tenant_phone VARCHAR(20),
        tenant_status VARCHAR(50) DEFAULT 'trial',
        tenant_additional_days INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_id VARCHAR(255) NOT NULL DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_daily_rate INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_validity_days INTEGER DEFAULT 30;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_price INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_discount INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_discounted_price INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS unlimited_users BOOLEAN DEFAULT false;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_name VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_document VARCHAR(20);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_email VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_phone VARCHAR(20);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_status VARCHAR(50) DEFAULT 'trial';
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS tenant_additional_days INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ALTER COLUMN start_date DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ALTER COLUMN end_date DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        UPDATE "${schema}".subscription SET starts_at = start_date::timestamptz WHERE starts_at IS NULL AND start_date IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        UPDATE "${schema}".subscription SET ends_at = end_date::timestamptz WHERE ends_at IS NULL AND end_date IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
    `;
    try {
      await this.tenantDb.runQuery(tenantId, dbUrl, migrationSql);
    } catch (e) {
      this.logger.warn(`ensureSubscriptionSchema: ${e.message}`);
    }
  }

  async findByTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    try {
      const result = await this.tenantDb.runQuery(
        tenantId,
        dbUrl,
        `SELECT * FROM "${schema}".subscription ORDER BY created_at DESC LIMIT 1`,
      );

      if (!result.rows.length) return null;

      const row = result.rows[0] as any;
      if (row.starts_at === undefined || row.ends_at === undefined) {
        await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);
        const retry = await this.tenantDb.runQuery(
          tenantId, dbUrl,
          `SELECT * FROM "${schema}".subscription ORDER BY created_at DESC LIMIT 1`,
        );
        if (retry.rows.length) return this.mapRow(retry.rows[0]);
      }

      return this.mapRow(row);
    } catch (e) {
      this.logger.warn(`findByTenant: banco do tenant ${tenantId} inacessivel: ${e.message}`);
      return null;
    }
  }

  async createTrial(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    this.logger.log(`createTrial: tenantId=${tenantId} schema=${schema}`);

    await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + 7);

    await this.tenantDb.runQuery(
      tenantId, dbUrl,
      `DELETE FROM "${schema}".subscription`,
    );

    const result = await this.tenantDb.runQuery(
      tenantId,
      dbUrl,
      `INSERT INTO "${schema}".subscription
        (plan_id, plan_name, plan_daily_rate, plan_validity_days, plan_price, plan_discount, plan_discounted_price, status, starts_at, ends_at, validity_days, max_users, unlimited_users)
       VALUES ('', 'Trial', 0, 7, 0, 0, 0, 'trial', $1, $2, 7, 1, false)
       RETURNING *`,
      [startsAt.toISOString(), endsAt.toISOString()],
    );

    this.logger.log(`createTrial: inserido ${result.rows.length} linha(s)`);
    return this.mapRow(result.rows[0]);
  }

  async syncTenantToClientDb(tenantId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        this.logger.warn(`syncTenantToClientDb: tenant ${tenantId} nao encontrado`);
        return;
      }

      const dbUrl = this.getDatabaseUrl(tenant);
      const schema = this.getSchema(tenant);

      this.logger.log(`syncTenantToClientDb: tenantId=${tenantId} schema=${schema} dbUrl=${dbUrl?.slice(0, 40)}...`);

      await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);

      const updateResult = await this.tenantDb.runQuery(
        tenantId, dbUrl,
        `UPDATE "${schema}".subscription
         SET tenant_name = $1, tenant_slug = $2, tenant_document = $3, tenant_email = $4,
             tenant_phone = $5, tenant_status = $6, tenant_additional_days = $7, updated_at = NOW()`,
        [
          tenant.name,
          tenant.slug,
          tenant.document || null,
          tenant.email,
          tenant.phone || null,
          tenant.status,
          tenant.additionalDays,
        ],
      );

      if (updateResult.rowCount === 0) {
        await this.tenantDb.runQuery(
          tenantId, dbUrl,
          `INSERT INTO "${schema}".subscription
           (tenant_name, tenant_slug, tenant_document, tenant_email, tenant_phone, tenant_status, tenant_additional_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenant.name,
            tenant.slug,
            tenant.document || null,
            tenant.email,
            tenant.phone || null,
            tenant.status,
            tenant.additionalDays,
          ],
        );
      }

      this.logger.log(`syncTenantToClientDb: dados do tenant espelhados para ${schema}.subscription`);
    } catch (e) {
      this.logger.error(`syncTenantToClientDb: erro ao espelhar tenant ${tenantId}: ${e.message}`);
    }
  }

  async assignPlan(tenantId: string, planId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    this.logger.log(`assignPlan: tenantId=${tenantId} planId=${planId} dbUrl=${dbUrl?.slice(0, 40)}... schema=${schema} databaseName=${tenant.databaseName}`);

    await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);

    const startsAt = new Date();
    const endsAt = calculateEndDate(startsAt, plan.validityDays);

    await this.tenantDb.runQuery(
      tenantId, dbUrl,
      `DELETE FROM "${schema}".subscription`,
    );

    const result = await this.tenantDb.runQuery(
      tenantId,
      dbUrl,
      `INSERT INTO "${schema}".subscription
        (plan_id, plan_name, plan_daily_rate, plan_validity_days, plan_price, plan_discount, plan_discounted_price, status, starts_at, ends_at, validity_days, max_users, unlimited_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        plan.id,
        plan.name,
        plan.dailyRate,
        plan.validityDays,
        plan.price,
        plan.discount,
        plan.discountedPrice,
        startsAt.toISOString(),
        endsAt.toISOString(),
        plan.validityDays,
        plan.maxUsers,
        plan.unlimitedUsers,
      ],
    );

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });

    this.logger.log(`assignPlan: inserido ${result.rows.length} linha(s)`);
    return this.mapRow(result.rows[0]);
  }

  async cancel(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);

    const result = await this.tenantDb.runQuery(
      tenantId,
      dbUrl,
      `UPDATE "${schema}".subscription
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE status != 'cancelled'
       RETURNING *`,
    );

    if (!result.rows.length) {
      const existing = await this.findByTenant(tenantId);
      if (!existing) throw new NotFoundException('Assinatura não encontrada');
      return existing;
    }

    return this.mapRow(result.rows[0]);
  }

  async updateStatus(tenantId: string, status: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    await this.ensureSubscriptionSchema(tenantId, dbUrl, schema);

    try {
      await this.tenantDb.runQuery(
        tenantId,
        dbUrl,
        `UPDATE "${schema}".subscription
         SET status = $1, cancelled_at = $2, updated_at = NOW()
         WHERE status != $1`,
        [status, status === 'inactive' || status === 'cancelled' ? new Date().toISOString() : null],
      );
    } catch (e) {
      this.logger.warn(`Falha ao atualizar status no tenant DB: ${e.message}`);
    }
  }

  async removeByPlan(planId: string) {
    const tenants = await this.prisma.tenant.findMany();
    for (const tenant of tenants) {
      const dbUrl = this.getDatabaseUrl(tenant);
      const schema = this.getSchema(tenant);
      try {
        await this.tenantDb.runQuery(
          tenant.id,
          dbUrl,
          `DELETE FROM "${schema}".subscription WHERE plan_id = $1`,
          [planId],
        );
      } catch (e) {
        this.logger.warn(`Falha ao remover subscriptions do plano ${planId} no tenant ${tenant.id}: ${e.message}`);
      }
    }
  }

  async removeByTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    const dbUrl = this.getDatabaseUrl(tenant);
    const schema = this.getSchema(tenant);

    try {
      await this.tenantDb.runQuery(
        tenantId,
        dbUrl,
        `DELETE FROM "${schema}".subscription`,
      );
    } catch (e) {
      this.logger.warn(`Falha ao remover subscriptions do tenant ${tenantId}: ${e.message}`);
    }
  }

  async countActive(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, settings: true, databaseUrl: true },
    });

    let count = 0;
    for (const tenant of tenants) {
      const dbUrl = this.getDatabaseUrl(tenant);
      const schema = this.getSchema(tenant);
      try {
        const result = await this.tenantDb.runQuery(
          tenant.id,
          dbUrl,
          `SELECT COUNT(*)::int AS cnt FROM "${schema}".subscription WHERE status = 'active'`,
        );
        count += parseInt(result.rows[0]?.cnt || '0', 10);
      } catch {
        // tenant DB may not be reachable
      }
    }
    return count;
  }
}
