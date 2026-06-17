import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlanDto, UpdatePlanDto } from '@gestao-prime/shared';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({
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

  async create(dto: CreatePlanDto) {
    const { productIds, ...planData } = dto;
    const plan = await this.prisma.plan.create({
      data: {
        name: planData.name,
        description: planData.description,
        price: Math.round(planData.price * 100),
        interval: planData.interval,
        intervalCount: planData.intervalCount,
        features: planData.features || [],
        products: {
          create: (productIds || []).map((productId: string) => ({ productId })),
        },
      },
      include: { products: { include: { product: true } } },
    });
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findById(id);
    const { productIds, ...planData } = dto;
    const data: any = { ...planData };
    if (planData.price !== undefined) data.price = Math.round(planData.price * 100);

    if (productIds) {
      await this.prisma.planProduct.deleteMany({ where: { planId: id } });
      await this.prisma.planProduct.createMany({
        data: (productIds || []).map((productId: string) => ({ planId: id, productId })),
      });
    }

    return this.prisma.plan.update({
      where: { id },
      data,
      include: { products: { include: { product: true } } },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.plan.delete({ where: { id } });
    return { message: 'Plano removido com sucesso' };
  }
}
