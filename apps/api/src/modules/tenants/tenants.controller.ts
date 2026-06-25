import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantsService } from './tenants.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTenantDto, UpdateTenantDto } from '@gestao-prime/shared';

@Controller('tenants')
export class TenantsController {
  constructor(
    private tenants: TenantsService,
    private monitoring: MonitoringService,
  ) {}

  @Get()
  findAll() {
    return this.tenants.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tenants.findById(id);
  }

  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.tenants.create(dto);
    const tenantId = result.id;
    this.monitoring.log({
      tenantId,
      userId: user.id,
      action: 'create',
      entity: 'tenant',
      entityId: tenantId,
      metadata: { name: result.name, slug: result.slug },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.tenants.update(id, dto);
    this.monitoring.log({
      tenantId: id,
      userId: user.id,
      action: 'update',
      entity: 'tenant',
      entityId: id,
      metadata: dto,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.tenants.remove(id);
    this.monitoring.log({
      tenantId: id,
      userId: user.id,
      action: 'delete',
      entity: 'tenant',
      entityId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
