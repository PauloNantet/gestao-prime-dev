import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateEndDate } from '@gestao-prime/shared';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async findByTenant(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true, tenant: true },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');
    return sub;
  }

  async assignPlan(tenantId: string, planId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const startsAt = new Date();
    const endsAt = calculateEndDate(startsAt, plan.interval, plan.intervalCount);

    const sub = await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        status: 'active',
        startsAt,
        endsAt,
      },
      update: {
        planId,
        status: 'active',
        startsAt,
        endsAt,
        cancelledAt: null,
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active', subscriptionId: sub.id },
    });

    return sub;
  }

  async cancel(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    return this.prisma.subscription.update({
      where: { tenantId },
      data: { status: 'inactive', cancelledAt: new Date() },
    });
  }
}
