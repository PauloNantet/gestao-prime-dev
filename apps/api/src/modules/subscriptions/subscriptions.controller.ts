import { Controller, Get, Post, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActionType } from '@gestao-prime/shared';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private subs: SubscriptionsService,
    private monitoring: MonitoringService,
  ) {}

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.subs.findByTenant(tenantId);
  }

  @Post('tenant/:tenantId/assign/:planId')
  async assignPlan(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.subs.assignPlan(tenantId, planId);
    this.monitoring.log({
      tenantId,
      userId: user.id,
      action: ActionType.UPDATE,
      entity: 'subscription',
      entityId: result.id,
      metadata: { planId, status: 'active' } as Record<string, unknown>,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('tenant/:tenantId/cancel')
  async cancel(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.subs.cancel(tenantId);
    this.monitoring.log({
      tenantId,
      userId: user.id,
      action: ActionType.UPDATE,
      entity: 'subscription',
      entityId: result.id,
      metadata: { status: 'cancelled' },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
