import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    return process.env.MASTER_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gestao_prime_master';
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } }, users: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
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
        status: 'trial',
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
    const { settings, ...rest } = dto;
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Tenant removido com sucesso' };
  }
}
