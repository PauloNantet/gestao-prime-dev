import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { DeployService } from './deploy.service';

@Controller('deploy')
export class DeployController {
  constructor(private deploy: DeployService) {}

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

  @Post(':tenantId/product/:productId')
  deployProduct(@Param('tenantId') tenantId: string, @Param('productId') productId: string) {
    return this.deploy.deployProduct(tenantId, '', { id: productId, name: '', slug: '', githubRepo: '', githubBranch: '' });
  }

  @Get(':tenantId')
  getDeployments(@Param('tenantId') tenantId: string) {
    return this.deploy.getDeployments(tenantId);
  }
}
