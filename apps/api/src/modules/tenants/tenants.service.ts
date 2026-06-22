import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { slugify, generateDatabaseName } from '@gestao-prime/shared';
import type { CreateTenantDto, UpdateTenantDto } from '@gestao-prime/shared';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private tenantDb: TenantDbService,
  ) {}

  private getMasterDbUrl(): string {
    return process.env.MASTER_DATABASE_URL || 'file:./prisma/dev.db';
  }

  private parseSettings(settings: string): Record<string, unknown> {
    try { return JSON.parse(settings); } catch { return {}; }
  }

  private formatTenant(t: any) {
    return { ...t, settings: this.parseSettings(t.settings) };
  }

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscription: { include: { plan: true } },
        products: { include: { product: { select: { id: true, name: true, icon: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map(t => this.formatTenant(t));
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
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
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
        status: (dto.status as any) || 'trial',
        ...(dto.settings ? { settings: JSON.stringify(dto.settings) } : {}),
        ...(dto.productIds?.length
          ? { products: { create: dto.productIds.map(pid => ({ productId: pid })) } }
          : {}),
      },
    });

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 7);

    await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'trial',
        endsAt,
      },
    });

    await this.tenantDb.runMigrations(tenant.id, databaseUrl, schemaName);

    return this.findById(tenant.id);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findById(id);
    const { settings, productIds, planId, ...rest } = dto;
    const data: any = {
      ...rest,
      ...(settings ? { settings: JSON.stringify(settings) } : {}),
    };
    if (productIds) {
      await this.prisma.tenantProduct.deleteMany({ where: { tenantId: id } });
      if (productIds.length > 0) {
        await this.prisma.tenantProduct.createMany({
          data: productIds.map(pid => ({ tenantId: id, productId: pid })),
        });
      }
    }
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plano não encontrado');
      const subscription = await this.prisma.subscription.findUnique({ where: { tenantId: id } });
      if (subscription) {
        await this.prisma.subscription.update({
          where: { tenantId: id },
          data: { planId },
        });
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
