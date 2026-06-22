import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeployService } from '../deploy/deploy.service';
import type { CreatePlanDto, UpdatePlanDto } from '@gestao-prime/shared';

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private deploy: DeployService,
  ) {}

  async findAll() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
      include: { products: { include: { product: true } } },
    });
  }

  async findByProduct(productId: string) {
    return this.prisma.plan.findMany({
      where: { products: { some: { productId } } },
      orderBy: { price: 'asc' },
      include: { products: { include: { product: true } } },
    });
  }

  async findActive() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
      include: { products: { include: { product: true } } },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { products: { include: { product: true } } },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  private async syncPlanToProducts(productIds: string[], plan: any, originalName?: string) {
    for (const pid of productIds) {
      try {
        await this.deploy.syncPlanToProductEnvironments(pid, {
          name: plan.name,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          intervalCount: plan.intervalCount,
          features: plan.features,
          active: plan.active,
          maxUsers: plan.maxUsers,
          unlimitedUsers: plan.unlimitedUsers,
          hasSupport: plan.hasSupport,
          hasUpdates: plan.hasUpdates,
          originalName: originalName || plan.name,
        });
      } catch {}
    }
  }

  async create(dto: CreatePlanDto) {
    const { productIds, ...planData } = dto;
    const plan = await this.prisma.plan.create({
      data: {
        name: planData.name,
        description: planData.description,
        price: Math.round(planData.price * 100),
        interval: planData.interval,
        intervalCount: planData.intervalCount,
        features: JSON.stringify(planData.features || []),
        maxUsers: planData.maxUsers ?? 1,
        unlimitedUsers: planData.unlimitedUsers ?? false,
        hasSupport: planData.hasSupport ?? false,
        hasUpdates: planData.hasUpdates ?? false,
        products: {
          create: (productIds || []).map((productId: string) => ({ productId })),
        },
      },
      include: { products: { include: { product: true } } },
    });

    if (productIds?.length) {
      await this.syncPlanToProducts(productIds, plan);
    }

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.findById(id);
    const { productIds, ...planData } = dto;
    const data: any = { ...planData };
    if (planData.price !== undefined) data.price = Math.round(planData.price * 100);
    if (data.features !== undefined) data.features = JSON.stringify(data.features);

    if (productIds) {
      await this.prisma.planProduct.deleteMany({ where: { planId: id } });
      await this.prisma.planProduct.createMany({
        data: (productIds || []).map((productId: string) => ({ planId: id, productId })),
      });
    }

    const plan = await this.prisma.plan.update({
      where: { id },
      data,
      include: { products: { include: { product: true } } },
    });

    if (productIds?.length) {
      await this.syncPlanToProducts(productIds, plan, existing.name);
    }

    return plan;
  }

  async remove(id: string) {
    const existing = await this.findById(id);
    const productIds = existing.products?.map((p: any) => p.productId) || [];

    await this.prisma.planProduct.deleteMany({ where: { planId: id } });
    await this.prisma.subscription.deleteMany({ where: { planId: id } });
    await this.prisma.plan.delete({ where: { id } });

    for (const pid of productIds) {
      try { await this.deploy.deletePlanFromProductEnvironments(pid, existing.name); } catch {}
    }

    return { message: 'Plano removido com sucesso' };
  }
}
