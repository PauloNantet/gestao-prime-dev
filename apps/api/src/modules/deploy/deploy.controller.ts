import { Controller, Post, Get, Put, Delete, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { DeployService } from './deploy.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('deploy')
export class DeployController {
  constructor(
    private deploy: DeployService,
    private prisma: PrismaService,
  ) {}

  @Get('railway/projects')
  getRailwayProjects() {
    return this.deploy.getRailwayProjects();
  }

  @Get('railway/projects/:projectId/environments')
  getProjectEnvironments(@Param('projectId') projectId: string) {
    return this.deploy.getProjectEnvironments(projectId);
  }

  @Get('railway/projects/:projectId/variables')
  getProjectVariables(
    @Param('projectId') projectId: string,
    @Query('environmentId') environmentId: string,
  ) {
    return this.deploy.getProjectVariables(projectId, environmentId);
  }

  @Get('railway/projects/:projectId/services')
  getProjectServices(@Param('projectId') projectId: string) {
    return this.deploy.getProjectServices(projectId);
  }

  @Get('railway/projects/:projectId/services/:serviceId/variables')
  getServiceVariables(
    @Param('projectId') projectId: string,
    @Param('serviceId') serviceId: string,
    @Query('environmentId') environmentId: string,
  ) {
    return this.deploy.getServiceVariables(projectId, environmentId, serviceId);
  }

  @Post(':tenantId/product/:productId')
  async deployProduct(@Param('tenantId') tenantId: string, @Param('productId') productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return this.deploy.deployProduct(tenantId, tenant?.slug || '', {
      id: product.id,
      name: product.name,
      slug: product.slug,
      githubRepo: product.githubRepo,
      githubBranch: product.githubBranch,
    });
  }

  @Get('railway/projects/:projectId/database-info')
  getProjectDatabaseInfo(
    @Param('projectId') projectId: string,
    @Query('environmentId') environmentId: string,
  ) {
    return this.deploy.getProjectDatabaseInfo(projectId, environmentId);
  }

  @Get('project-databases')
  getProjectDatabases() {
    return this.deploy.getProjectDatabases();
  }

  @Post('project-databases')
  saveProjectDatabase(@Body() body: { projectId: string; environmentId: string; projectName: string; environmentName: string; databaseUrl: string }) {
    return this.deploy.saveProjectDatabase(body.projectId, body.environmentId, body.projectName, body.environmentName, body.databaseUrl);
  }

  @Delete('project-databases/:projectId/:environmentId')
  deleteProjectDatabase(@Param('projectId') projectId: string, @Param('environmentId') environmentId: string) {
    return this.deploy.deleteProjectDatabase(projectId, environmentId);
  }

  @Get('project-databases/:projectId/:environmentId/query')
  queryProjectTable(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Query('table') tableName?: string,
  ) {
    return this.deploy.queryProjectTable(projectId, environmentId, tableName);
  }

  @Get('project-databases/:projectId/:environmentId/columns')
  getTableColumns(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Query('table') tableName: string,
  ) {
    return this.deploy.getTableColumns(projectId, environmentId, tableName);
  }

  @Post('project-databases/:projectId/:environmentId/insert')
  insertIntoTable(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() body: { table: string; data: Record<string, any> },
  ) {
    return this.deploy.insertIntoTable(projectId, environmentId, body.table, body.data);
  }

  @Put('project-databases/:projectId/:environmentId/update')
  updateTableRow(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() body: { table: string; idColumn: string; idValue: any; data: Record<string, any> },
  ) {
    return this.deploy.updateTableRow(projectId, environmentId, body.table, body.idColumn, body.idValue, body.data);
  }

  @Post('direct-query')
  directQuery(@Body() body: { databaseUrl: string; table?: string }) {
    return this.deploy.directQuery(body.databaseUrl, body.table);
  }

  @Post('direct-columns')
  directGetColumns(@Body() body: { databaseUrl: string; table: string }) {
    return this.deploy.directGetColumns(body.databaseUrl, body.table);
  }

  @Post('direct-insert')
  directInsert(@Body() body: { databaseUrl: string; table: string; data: Record<string, any> }) {
    return this.deploy.directInsert(body.databaseUrl, body.table, body.data);
  }

  @Put('direct-update')
  directUpdate(@Body() body: { databaseUrl: string; table: string; idColumn: string; idValue: any; data: Record<string, any> }) {
    return this.deploy.directUpdate(body.databaseUrl, body.table, body.idColumn, body.idValue, body.data);
  }

  @Get(':tenantId')
  getDeployments(@Param('tenantId') tenantId: string) {
    return this.deploy.getDeployments(tenantId);
  }
}
