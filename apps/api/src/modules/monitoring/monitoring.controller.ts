import { Controller, Get, Param, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private monitoring: MonitoringService) {}

  @Get('dashboard')
  getDashboard() {
    return this.monitoring.getDashboardStats();
  }

  @Get('logs/:tenantId')
  getLogs(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoring.findByTenant(tenantId, Number(page) || 1, Number(limit) || 50);
  }
}
