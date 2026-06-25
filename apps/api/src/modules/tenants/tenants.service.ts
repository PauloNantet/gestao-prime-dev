import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { slugify, generateDatabaseName, calculateEndDate } from '@gestao-prime/shared';
import type { CreateTenantDto, UpdateTenantDto } from '@gestao-prime/shared';
import { Pool } from 'pg';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private tenantDb: TenantDbService,
  ) {}

  private getMasterDbUrl(): string {
    return process.env.MASTER_DATABASE_URL || '';
  }

  private parseSettings(settings: string): Record<string, unknown> {
    try { return JSON.parse(settings); } catch { return {}; }
  }

  private intervalToMonths(interval: string, count: number): number {
    switch (interval) {
      case 'monthly': return count;
      case 'quarterly': return count * 3;
      case 'semestral': return count * 6;
      case 'yearly': return count * 12;
      default: return count;
    }
  }

  private formatTenant(t: any) {
    return { ...t, settings: this.parseSettings(t.settings) };
  }

  private async getExternalPool(tenantId: string): Promise<{ pool: Pool; tenant: any } | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;
    const settings = this.parseSettings(tenant.settings);
    const railwayDbUrl = settings?.railwayDatabaseUrl as string;
    if (!railwayDbUrl || !railwayDbUrl.startsWith('postgresql')) return null;
    const pool = new Pool({ connectionString: railwayDbUrl, max: 1, idleTimeoutMillis: 5000 });
    return { pool, tenant };
  }

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscription: { include: { plan: true } },
        products: { include: { product: { select: { id: true, name: true, icon: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map((t: any) => this.formatTenant(t));
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } }, users: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return this.formatTenant(tenant);
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

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const databaseName = generateDatabaseName(slug);
    const databaseUrl = dto.databaseUrl || this.getMasterDbUrl();
    const schemaName = databaseName;

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        databaseUrl,
        databaseName,
        status: (dto.status as any) || 'active',
        ...(dto.settings ? { settings: JSON.stringify(dto.settings) } : {}),
        ...(dto.productIds?.length
          ? { products: { create: dto.productIds.map((pid: string) => ({ productId: pid })) } }
          : {}),
      },
    });

    const endsAt = calculateEndDate(new Date(), plan.interval, plan.intervalCount);

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'active',
        endsAt,
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionId: subscription.id },
    });

    if (databaseUrl && databaseUrl.startsWith('postgresql')) {
      await this.tenantDb.runMigrations(tenant.id, databaseUrl, schemaName);

      try {
        const pool = new Pool({ connectionString: databaseUrl, max: 1, idleTimeoutMillis: 5000 });

        const planResult = await pool.query('SELECT id FROM plans WHERE name = $1 LIMIT 1', [plan.name]);
        let externalPlanId = planResult.rows.length > 0 ? planResult.rows[0].id : null;

        if (externalPlanId === null) {
          const insertPlan = await pool.query(
            `INSERT INTO plans (name, description, period_months, monthly_price, savings, total_price, max_users, unlimited_users, has_support, has_updates, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [
              plan.name, plan.description || '', this.intervalToMonths(plan.interval, plan.intervalCount),
              plan.price / 100, plan.savings || '0%', plan.price / 100,
              plan.maxUsers, plan.unlimitedUsers, plan.hasSupport, plan.hasUpdates, plan.active,
            ],
          );
          externalPlanId = insertPlan.rows[0].id;
          console.log('[TenantsService] Plano criado no DB externo:', plan.name, '(id:', externalPlanId, ')');
        }

        const now = new Date();
        const endsAtExt = new Date();
        endsAtExt.setMonth(endsAtExt.getMonth() + (this.intervalToMonths(plan.interval, plan.intervalCount)));

        await pool.query('DELETE FROM subscriptions');
        await pool.query(
          'INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date) VALUES ($1, $2, $3, $4, $5)',
          [1, externalPlanId, 'active', now.toISOString().split('T')[0], endsAtExt.toISOString().split('T')[0]],
        );
        console.log('[TenantsService] Subscription criada - plan_id:', externalPlanId, '(master:', plan.id, ')');

        await pool.end();
      } catch (e) {
        console.error('[TenantsService] Erro ao criar subscription no DB externo:', e.message);
      }
    }

    return this.findById(tenant.id);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findById(id);
    const { settings, productIds, planId, status, ...rest } = dto;
    const data: any = {
      ...rest,
      ...(settings ? { settings: JSON.stringify(settings) } : {}),
    };

    if (status) {
      data.status = status;
      const subscription = await this.prisma.subscription.findUnique({ where: { tenantId: id } });
      if (subscription) {
        await this.prisma.subscription.update({ where: { tenantId: id }, data: { status: status as any } });

        const ext = await this.getExternalPool(id);
        if (ext) {
          try {
            if (status === 'inactive') {
              await ext.pool.query('UPDATE subscriptions SET status = $1, cancelled_at = NOW() WHERE status != $1', [status]);
            } else {
              await ext.pool.query('UPDATE subscriptions SET status = $1, cancelled_at = NULL WHERE status != $1', [status]);
            }
            console.log('[TenantsService] Status atualizado no DB externo:', status);
          } catch (e) {
            console.error('[TenantsService] Erro ao atualizar status no DB externo:', e.message);
          } finally {
            try { await ext.pool.end(); } catch {}
          }
        }
      }
    }

    if (productIds) {
      await this.prisma.tenantProduct.deleteMany({ where: { tenantId: id } });
      if (productIds.length > 0) {
        await this.prisma.tenantProduct.createMany({
          data: productIds.map((pid: string) => ({ tenantId: id, productId: pid })),
        });
      }
    }

    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado');

      const subscription = await this.prisma.subscription.findUnique({ where: { tenantId: id } });
      if (subscription) {
        await this.prisma.subscription.update({ where: { tenantId: id }, data: { planId } });

        const ext = await this.getExternalPool(id);
        if (ext) {
          try {
            let planResult = await ext.pool.query('SELECT id FROM plans WHERE name = $1 LIMIT 1', [plan.name]);
            let externalPlanId = planResult.rows.length > 0 ? planResult.rows[0].id : null;

            if (externalPlanId === null) {
              const insertPlan = await ext.pool.query(
                `INSERT INTO plans (name, description, period_months, monthly_price, savings, total_price, max_users, unlimited_users, has_support, has_updates, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [
                  plan.name, plan.description || '', this.intervalToMonths(plan.interval, plan.intervalCount),
                  plan.price / 100, plan.savings || '0%', plan.price / 100,
                  plan.maxUsers, plan.unlimitedUsers, plan.hasSupport, plan.hasUpdates, plan.active,
                ],
              );
              externalPlanId = insertPlan.rows[0].id;
              console.log('[TenantsService] Plano criado no DB externo:', plan.name, '(id:', externalPlanId, ')');
            }

            const now = new Date();
            const endsAt = new Date();
            endsAt.setMonth(endsAt.getMonth() + this.intervalToMonths(plan.interval, plan.intervalCount));

            await ext.pool.query('DELETE FROM subscriptions');
            await ext.pool.query(
              'INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date) VALUES ($1, $2, $3, $4, $5)',
              [1, externalPlanId, 'active', now.toISOString().split('T')[0], endsAt.toISOString().split('T')[0]],
            );
            console.log('[TenantsService] Plan_id atualizado no DB externo:', externalPlanId, '(master:', planId, ')');
          } catch (e) {
            console.error('[TenantsService] Erro ao atualizar plan_id no DB externo:', e.message);
          } finally {
            try { await ext.pool.end(); } catch {}
          }
        }
      }
    }

    return this.prisma.tenant.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.auditLog.deleteMany({ where: { tenantId: id } });
    await this.prisma.deployment.deleteMany({ where: { tenantId: id } });
    await this.prisma.invoice.deleteMany({ where: { tenantId: id } });
    await this.prisma.user.deleteMany({ where: { tenantId: id } });
    await this.prisma.subscription.deleteMany({ where: { tenantId: id } });

    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Tenant removido com sucesso' };
  }
}
