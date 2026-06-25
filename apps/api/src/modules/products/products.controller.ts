import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProductDto, UpdateProductDto } from '@gestao-prime/shared';

@Controller('products')
export class ProductsController {
  constructor(
    private products: ProductsService,
    private monitoring: MonitoringService,
  ) {}

  @Get()
  findAll() {
    return this.products.findAll();
  }

  @Get('active')
  findActive() {
    return this.products.findActive();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.products.findById(id);
  }

  @Post()
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.products.create(dto);
    if (user.tenantId) {
      this.monitoring.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'create',
        entity: 'product',
        entityId: result.id,
        metadata: { name: result.name, slug: result.slug },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.products.update(id, dto);
    if (user.tenantId) {
      this.monitoring.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'update',
        entity: 'product',
        entityId: id,
        metadata: dto,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.products.remove(id);
    if (user.tenantId) {
      this.monitoring.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'delete',
        entity: 'product',
        entityId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }
}
