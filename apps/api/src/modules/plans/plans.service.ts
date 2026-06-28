import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionDbService } from '../../common/database/subscription-db.service';
import type { CreatePlanDto, UpdatePlanDto } from '@gestao-prime/shared';

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private subscriptionDb: SubscriptionDbService,
  ) {}

  private planInclude = { product: { select: { id: true, name: true, slug: true } } };

  private calculateValues(data: { dailyRate: number; validityDays: number; discount: number }) {
    const price = data.dailyRate * data.validityDays;
    const discountAmount = Math.round(price * (data.discount / 100));
    const discountedPrice = price - discountAmount;
    return { price, discountAmount, discountedPrice };
  }

  async findAll() {
    return this.prisma.plan.findMany({
      orderBy: { position: 'asc' },
      include: this.planInclude,
    });
  }

  async findByProduct(productId: string) {
    return this.prisma.plan.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      include: this.planInclude,
    });
  }

  async findActive() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      include: this.planInclude,
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: this.planInclude,
    });
    if (!plan) throw new NotFoundException('Plano nao encontrado');
    return plan;
  }

  private async resequence(productId: string) {
    const plans = await this.prisma.plan.findMany({
      where: { productId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    await this.prisma.$transaction(
      plans.map((p, i) => this.prisma.plan.update({ where: { id: p.id }, data: { position: i } })),
    );
  }

  async create(dto: CreatePlanDto) {
    await this.resequence(dto.productId);

    const maxPos = await this.prisma.plan.aggregate({
      where: { productId: dto.productId },
      _max: { position: true },
    });

    const dailyRate = Math.round(dto.dailyRate * 100);
    const validityDays = dto.validityDays ?? 30;
    const discount = dto.discount ?? 0;
    const { price, discountAmount, discountedPrice } = this.calculateValues({ dailyRate, validityDays, discount });

    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        dailyRate,
        validityDays,
        price,
        discount,
        discountedPrice,
        savings: discountAmount,
        maxUsers: dto.maxUsers ?? 1,
        unlimitedUsers: dto.unlimitedUsers ?? false,
        hasSupport: dto.hasSupport ?? false,
        hasUpdates: dto.hasUpdates ?? false,
        position: (maxPos._max.position ?? -1) + 1,
        productId: dto.productId,
      },
      include: this.planInclude,
    });

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.findById(id);

    const dailyRate = dto.dailyRate !== undefined ? Math.round(dto.dailyRate * 100) : existing.dailyRate;
    const validityDays = dto.validityDays ?? existing.validityDays;
    const discount = dto.discount ?? existing.discount;
    const { price, discountAmount, discountedPrice } = this.calculateValues({ dailyRate, validityDays, discount });

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...dto,
        dailyRate,
        validityDays,
        discount,
        price,
        discountedPrice,
        savings: discountAmount,
      },
      include: this.planInclude,
    });

    return plan;
  }

  async reorder(id: string, direction: 'up' | 'down') {
    const plan = await this.findById(id);
    const siblings = await this.prisma.plan.findMany({
      where: { productId: plan.productId },
      orderBy: { position: 'asc' },
    });

    const idx = siblings.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException('Plano nao encontrado');

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return plan;

    const a = siblings[idx];
    const b = siblings[swapIdx];

    await this.prisma.$transaction([
      this.prisma.plan.update({ where: { id: a.id }, data: { position: b.position } }),
      this.prisma.plan.update({ where: { id: b.id }, data: { position: a.position } }),
    ]);

    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);

    await this.subscriptionDb.removeByPlan(id);
    await this.prisma.plan.delete({ where: { id } });

    return { message: 'Plano removido com sucesso' };
  }
}
