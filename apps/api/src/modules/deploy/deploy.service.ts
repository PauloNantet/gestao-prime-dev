import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ProductInfo {
  id: string;
  name: string;
  slug: string;
  githubRepo: string;
  githubBranch: string;
}

@Injectable()
export class DeployService {
  private readonly RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN || '';

  constructor(private prisma: PrismaService) {}

  private async railwayRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0].message);
    return data.data;
  }

  async getRailwayProjects() {
    if (!this.RAILWAY_API_TOKEN) return [];
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
            }
          }
        }
      }
    `;
    const data = await this.railwayRequest<{ projects: { edges: Array<{ node: any }> } }>(query);
    return (data.projects?.edges || []).map(e => e.node);
  }

  async getProjectEnvironments(projectId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const query = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;
    const data = await this.railwayRequest<{ project: { environments: { edges: Array<{ node: any }> } } }>(query, { projectId });
    return data.project?.environments?.edges?.map(e => e.node) || [];
  }

  async getProjectVariables(projectId: string, environmentId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const query = `
      query GetVariables($projectId: String!, $environmentId: String!) {
        variables(projectId: $projectId, environmentId: $environmentId)
      }
    `;
    const data = await this.railwayRequest<{ variables: Record<string, string> }>(query, { projectId, environmentId });
    if (!data.variables) return [];
    return Object.entries(data.variables).map(([name, value]) => ({ name, value }));
  }

  async deployProduct(tenantId: string, tenantSlug: string, product: ProductInfo) {
    const deployment = await this.prisma.deployment.create({
      data: {
        tenantId,
        productId: product.id,
        status: 'pending',
      },
    });

    if (!this.RAILWAY_API_TOKEN) {
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'deployed',
          railwayUrl: `https://${product.slug}-${tenantSlug}.up.railway.app`,
          deployedAt: new Date(),
        },
      });
      return { message: 'Simulated deploy (no Railway token)' };
    }

    try {
      const serviceName = `${product.slug}-${tenantSlug}`.replace(/[^a-zA-Z0-9-]/g, '-');

      const projectId = await this.getOrCreateRailwayProject(tenantSlug);

      const serviceId = await this.createRailwayService(projectId, serviceName, product.githubRepo);

      const url = await this.getServiceUrl(projectId, serviceId);

      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'deployed',
          railwayServiceId: serviceId,
          railwayUrl: url,
          deployedAt: new Date(),
        },
      });

      return { serviceId, url, projectId };
    } catch (err: any) {
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'failed',
          errorMessage: err.message || 'Erro no deploy',
        },
      });
      throw err;
    }
  }

  async getDeployments(tenantId: string) {
    return this.prisma.deployment.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOrCreateRailwayProject(tenantSlug: string): Promise<string> {
    const query = `
      mutation ProjectCreate($name: String!) {
        projectCreate(input: { name: $name }) {
          project { id }
        }
      }
    `;

    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { name: `gp-${tenantSlug}` } }),
    });

    const data = await res.json();
    return data.data?.projectCreate?.project?.id;
  }

  private async createRailwayService(projectId: string, name: string, repo: string): Promise<string> {
    const query = `
      mutation ServiceCreate($projectId: String!, $name: String!, $repo: String!) {
        serviceCreate(input: {
          projectId: $projectId,
          name: $name,
          source: { repo: $repo }
        }) { service { id } }
      }
    `;

    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { projectId, name, repo } }),
    });

    const data = await res.json();
    return data.data?.serviceCreate?.service?.id;
  }

  private async getServiceUrl(projectId: string, serviceId: string): Promise<string> {
    const query = `
      query ServiceDomains($serviceId: String!) {
        service(id: $serviceId) {
          domains { edges { node { domain } } }
        }
      }
    `;

    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { serviceId } }),
    });

    const data = await res.json();
    return data.data?.service?.domains?.edges?.[0]?.node?.domain || `https://${serviceId}.up.railway.app`;
  }
}
