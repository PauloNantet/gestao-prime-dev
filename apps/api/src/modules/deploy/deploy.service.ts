import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Pool } from 'pg';

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
    try {
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
    } catch {
      return [];
    }
  }

  private async safeRailwayRequest<T>(query: string, variables?: Record<string, any>): Promise<T | null> {
    try {
      return await this.railwayRequest<T>(query, variables);
    } catch {
      return null;
    }
  }

  async getProjectEnvironments(projectId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const data = await this.safeRailwayRequest<{ project: { environments: { edges: Array<{ node: any }> } } }>(
      `query GetProject($projectId: String!) {
        project(id: $projectId) {
          environments {
            edges { node { id name } }
          }
        }
      }`, { projectId });
    return data?.project?.environments?.edges?.map(e => e.node) || [];
  }

  async getProjectServices(projectId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const data = await this.safeRailwayRequest<{ project: { services: { edges: Array<{ node: any }> } } }>(
      `query GetProject($projectId: String!) {
        project(id: $projectId) {
          services {
            edges { node { id name } }
          }
        }
      }`, { projectId });
    return data?.project?.services?.edges?.map(e => e.node) || [];
  }

  async getServiceVariables(projectId: string, environmentId: string, serviceId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const data = await this.safeRailwayRequest<{ variables: Record<string, string> }>(
      `query GetVariables($projectId: String!, $environmentId: String!, $serviceId: String!) {
        variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
      }`, { projectId, environmentId, serviceId });
    if (!data?.variables) return [];
    return Object.entries(data.variables).map(([name, value]) => ({ name, value }));
  }

  async getProjectVariables(projectId: string, environmentId: string) {
    if (!this.RAILWAY_API_TOKEN) return [];
    const data = await this.safeRailwayRequest<{ variables: Record<string, string> }>(
      `query GetVariables($projectId: String!, $environmentId: String!) {
        variables(projectId: $projectId, environmentId: $environmentId)
      }`, { projectId, environmentId });
    if (!data?.variables) return [];
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

  async getProjectDatabaseInfo(projectId: string, environmentId: string) {
    if (!this.RAILWAY_API_TOKEN) return null;
    const variables = await this.getProjectVariables(projectId, environmentId);

    const dbUrlKey = variables.find(v =>
      /database_url|postgres_url|master_database_url/i.test(v.name)
    );
    const redisUrlKey = variables.find(v =>
      /redis_url/i.test(v.name)
    );

    function parsePostgresUrl(url: string) {
      try {
        const u = new URL(url);
        return {
          host: u.hostname,
          port: u.port || '5432',
          database: u.pathname.replace(/^\//, ''),
          user: u.username,
          scheme: u.protocol.replace(':', ''),
        };
      } catch {
        return null;
      }
    }

    const dbInfo = dbUrlKey ? parsePostgresUrl(dbUrlKey.value) : null;
    const redisInfo = redisUrlKey ? parsePostgresUrl(redisUrlKey.value) : null;

    return {
      database: dbInfo ? {
        variableName: dbUrlKey!.name,
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        user: dbInfo.user,
        scheme: dbInfo.scheme,
      } : null,
      redis: redisInfo ? {
        variableName: redisUrlKey!.name,
        host: redisInfo.host,
        port: redisInfo.port,
        database: redisInfo.database,
        user: redisInfo.user,
        scheme: redisInfo.scheme,
      } : null,
    };
  }

  async getProjectDatabases() {
    return this.prisma.projectDatabase.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async saveProjectDatabase(projectId: string, environmentId: string, projectName: string, environmentName: string, databaseUrl: string) {
    return this.prisma.projectDatabase.upsert({
      where: { projectId_environmentId: { projectId, environmentId } },
      create: { projectId, environmentId, projectName, environmentName, databaseUrl },
      update: { projectName, environmentName, databaseUrl },
    });
  }

  async deleteProjectDatabase(projectId: string, environmentId: string) {
    await this.prisma.projectDatabase.delete({
      where: { projectId_environmentId: { projectId, environmentId } },
    });
    return { message: 'Removido' };
  }

  async queryProjectTable(projectId: string, environmentId: string, tableName?: string) {
    const config = await this.prisma.projectDatabase.findUnique({
      where: { projectId_environmentId: { projectId, environmentId } },
    });
    if (!config) throw new NotFoundException('Database URL não configurada para este ambiente');

    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, idleTimeoutMillis: 5000 });
    try {
      const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const allTables = tables.rows.map(r => r.table_name);

      let data: any[] = [];
      if (tableName && allTables.includes(tableName)) {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100`);
        data = result.rows;
      }

      await pool.end();
      return { tables: allTables, data, tableName: tableName || null };
    } catch (err: any) {
      await pool.end().catch(() => {});
      throw new Error(`Erro ao conectar: ${err.message}`);
    }
  }

  async getTableColumns(projectId: string, environmentId: string, tableName: string) {
    const config = await this.prisma.projectDatabase.findUnique({
      where: { projectId_environmentId: { projectId, environmentId } },
    });
    if (!config) throw new NotFoundException('Database URL não configurada para este ambiente');

    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, idleTimeoutMillis: 5000 });
    try {
      const [columnsRes, pkRes] = await Promise.all([
        pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]),
        pool.query(`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        `, [tableName]),
      ]);

      await pool.end();
      const pkColumn = pkRes.rows[0]?.column_name || null;
      return {
        columns: columnsRes.rows.map(r => ({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === 'YES',
          default: r.column_default,
        })),
        primaryKey: pkColumn,
      };
    } catch (err: any) {
      await pool.end().catch(() => {});
      throw new Error(`Erro ao obter colunas: ${err.message}`);
    }
  }

  async insertIntoTable(projectId: string, environmentId: string, tableName: string, data: Record<string, any>) {
    const config = await this.prisma.projectDatabase.findUnique({
      where: { projectId_environmentId: { projectId, environmentId } },
    });
    if (!config) throw new NotFoundException('Database URL não configurada para este ambiente');

    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, idleTimeoutMillis: 5000 });
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const quotedColumns = columns.map(c => `"${c}"`).join(', ');

      const result = await pool.query(
        `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders}) RETURNING *`,
        values,
      );

      await pool.end();
      return { inserted: result.rows[0] };
    } catch (err: any) {
      await pool.end().catch(() => {});
      throw new Error(`Erro ao inserir: ${err.message}`);
    }
  }

  async updateTableRow(projectId: string, environmentId: string, tableName: string, idColumn: string, idValue: any, data: Record<string, any>) {
    const config = await this.prisma.projectDatabase.findUnique({
      where: { projectId_environmentId: { projectId, environmentId } },
    });
    if (!config) throw new NotFoundException('Database URL não configurada para este ambiente');

    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, idleTimeoutMillis: 5000 });
    try {
      const setColumns = Object.keys(data);
      if (setColumns.length === 0) {
        await pool.end();
        return { updated: null };
      }
      const setClauses = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
      const values = Object.values(data);
      const idIndex = values.length + 1;

      const result = await pool.query(
        `UPDATE "${tableName}" SET ${setClauses} WHERE "${idColumn}" = $${idIndex} RETURNING *`,
        [...values, idValue],
      );

      await pool.end();
      return { updated: result.rows[0] || null };
    } catch (err: any) {
      await pool.end().catch(() => {});
      throw new Error(`Erro ao atualizar: ${err.message}`);
    }
  }

  private async withDb<T>(databaseUrl: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
    const pool = new Pool({ connectionString: databaseUrl, max: 1, idleTimeoutMillis: 5000 });
    try {
      return await fn(pool);
    } finally {
      await pool.end().catch(() => {});
    }
  }

  async directQuery(databaseUrl: string, tableName?: string) {
    return this.withDb(databaseUrl, async (pool) => {
      const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const allTables = tables.rows.map(r => r.table_name);
      let data: any[] = [];
      if (tableName && allTables.includes(tableName)) {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100`);
        data = result.rows;
      }
      return { tables: allTables, data, tableName: tableName || null };
    });
  }

  async directGetColumns(databaseUrl: string, tableName: string) {
    return this.withDb(databaseUrl, async (pool) => {
      const [columnsRes, pkRes] = await Promise.all([
        pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]),
        pool.query(`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        `, [tableName]),
      ]);
      return {
        columns: columnsRes.rows.map(r => ({
          name: r.column_name, type: r.data_type,
          nullable: r.is_nullable === 'YES', default: r.column_default,
        })),
        primaryKey: pkRes.rows[0]?.column_name || null,
      };
    });
  }

  async directInsert(databaseUrl: string, tableName: string, data: Record<string, any>) {
    return this.withDb(databaseUrl, async (pool) => {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const quotedColumns = columns.map(c => `"${c}"`).join(', ');
      const result = await pool.query(
        `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders}) RETURNING *`,
        values,
      );
      return { inserted: result.rows[0] };
    });
  }

  async directUpdate(databaseUrl: string, tableName: string, idColumn: string, idValue: any, data: Record<string, any>) {
    return this.withDb(databaseUrl, async (pool) => {
      const setColumns = Object.keys(data);
      if (setColumns.length === 0) return { updated: null };
      const setClauses = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
      const values = Object.values(data);
      const idIndex = values.length + 1;
      const result = await pool.query(
        `UPDATE "${tableName}" SET ${setClauses} WHERE "${idColumn}" = $${idIndex} RETURNING *`,
        [...values, idValue],
      );
      return { updated: result.rows[0] || null };
    });
  }

  async syncPlanToProductEnvironments(_productId: string, _planData: any) {
    return { synced: 0, total: 0, errors: [], message: 'Sync desabilitado' };
  }

  async deletePlanFromProductEnvironments(_productId: string, _planName: string) {
    return { deleted: 0, total: 0 };
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
