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
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.monitoring.findByTenant(
      tenantId,
      Number(page) || 1,
      Number(limit) || 50,
      from || undefined,
      to || undefined,
    );
  }

  @Get('logs/:tenantId/export')
  exportLogs(
    @Param('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.monitoring.exportLogs(tenantId, from || undefined, to || undefined);
  }
}
