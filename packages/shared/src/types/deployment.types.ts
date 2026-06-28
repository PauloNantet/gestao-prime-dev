export enum DeploymentStatus {
  PENDING = 'pending',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
}

export interface Deployment {
  id: string;
  tenantId: string;
  productId: string;
  status: DeploymentStatus;
  railwayServiceId: string | null;
  railwayUrl: string | null;
  errorMessage: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface CreateDeploymentDto {
  tenantId: string;
  productId: string;
}
