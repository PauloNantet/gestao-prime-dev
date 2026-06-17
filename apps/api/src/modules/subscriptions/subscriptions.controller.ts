import { Controller, Get, Post, Param } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService) {}

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.subs.findByTenant(tenantId);
  }

  @Post('tenant/:tenantId/assign/:planId')
  assignPlan(@Param('tenantId') tenantId: string, @Param('planId') planId: string) {
    return this.subs.assignPlan(tenantId, planId);
  }

  @Post('tenant/:tenantId/cancel')
  cancel(@Param('tenantId') tenantId: string) {
    return this.subs.cancel(tenantId);
  }
}
