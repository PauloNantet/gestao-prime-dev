import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from '@gestao-prime/shared';

@Controller('plans')
export class PlansController {
  constructor(private plans: PlansService) {}

  @Get()
  findAll(@Query('productId') productId?: string) {
    if (productId) return this.plans.findByProduct(productId);
    return this.plans.findAll();
  }

  @Get('active')
  findActive() {
    return this.plans.findActive();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.plans.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plans.remove(id);
  }
}
