import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionDbService } from '../../common/database/subscription-db.service';

@Injectable()
export class SubscriptionsService {
  constructor(private subscriptionDb: SubscriptionDbService) {}

  async findByTenant(tenantId: string) {
    const sub = await this.subscriptionDb.findByTenant(tenantId);
    if (!sub) throw new NotFoundException('Assinatura não encontrada');
    return sub;
  }

  async assignPlan(tenantId: string, planId: string) {
    return this.subscriptionDb.assignPlan(tenantId, planId);
  }

  async cancel(tenantId: string) {
    return this.subscriptionDb.cancel(tenantId);
  }
}
