import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from '@gestao-prime/shared';

@Controller('tenants')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get()
  findAll() {
    return this.tenants.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tenants.findById(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenants.remove(id);
  }
}
