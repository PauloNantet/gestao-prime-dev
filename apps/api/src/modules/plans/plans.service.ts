import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlanDto, UpdatePlanDto } from '@gestao-prime/shared';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
  }

  async findActive() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: Math.round(dto.price * 100),
        interval: dto.interval,
        intervalCount: dto.intervalCount,
        features: dto.features || [],
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findById(id);
    const data: any = { ...dto };
    if (dto.price !== undefined) data.price = Math.round(dto.price * 100);
    return this.prisma.plan.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.plan.delete({ where: { id } });
    return { message: 'Plano removido com sucesso' };
  }
}
