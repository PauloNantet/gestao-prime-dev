import { Controller, Post, Get, Param } from '@nestjs/common';
import { DeployService } from './deploy.service';

@Controller('deploy')
export class DeployController {
  constructor(private deploy: DeployService) {}

  @Post(':tenantId/product/:productId')
  deployProduct(@Param('tenantId') tenantId: string, @Param('productId') productId: string) {
    return this.deploy.deployProduct(tenantId, '', { id: productId, name: '', slug: '', githubRepo: '', githubBranch: '' });
  }

  @Get(':tenantId')
  getDeployments(@Param('tenantId') tenantId: string) {
    return this.deploy.getDeployments(tenantId);
  }
}
