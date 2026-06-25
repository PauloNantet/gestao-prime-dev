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

  private planIntervalToMonths(interval: string, count: number): number {
    const multiplier: Record<string, number> = { monthly: 1, quarterly: 3, semestral: 6, yearly: 12 };
    return (multiplier[interval] || 1) * count;
  }

  async syncPlanToProductEnvironments(productId: string, planData: { name: string; description: string | null; price: number; interval: string; intervalCount: number; features: string; active: boolean; maxUsers: number; unlimitedUsers: boolean; hasSupport: boolean; hasUpdates: boolean; originalName?: string }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product?.projectId) return { synced: 0, message: 'Produto sem projeto Railway' };

    const databases = await this.prisma.projectDatabase.findMany({
      where: { projectId: product.projectId },
    });

    if (databases.length === 0) return { synced: 0, message: 'Nenhum banco configurado para este projeto' };

    const monthlyPrice = planData.price / 100;
    const periodMonths = this.planIntervalToMonths(planData.interval, planData.intervalCount);
    const totalPrice = monthlyPrice * periodMonths;

    const basePrice = product.basePrice / 100;
    const anualProjection = monthlyPrice * 12;
    const savings = basePrice > 0 ? `${Math.round(((basePrice - anualProjection) / basePrice) * 100)}%` : '';

    const lookupName = planData.originalName || planData.name;

    let synced = 0;
    const errors: string[] = [];

    for (const db of databases) {
      try {
        await this.withDb(db.databaseUrl, async (pool) => {
          const exists = await pool.query(`SELECT id FROM plans WHERE name = $1`, [lookupName]);

          if (exists.rows.length > 0) {
            await pool.query(`
              UPDATE plans SET name = $2, period_months = $3, monthly_price = $4, total_price = $5,
                max_users = $6, has_support = $7, has_updates = $8, is_active = $9,
                unlimited_users = $10, savings = $11
              WHERE name = $1
            `, [lookupName, planData.name, periodMonths, monthlyPrice, totalPrice, planData.maxUsers, planData.hasSupport, planData.hasUpdates, planData.active, planData.unlimitedUsers, savings]);
          } else {
            await pool.query(`
              INSERT INTO plans (name, period_months, monthly_price, total_price, max_users, has_support, has_updates, is_active, unlimited_users, savings, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [planData.name, periodMonths, monthlyPrice, totalPrice, planData.maxUsers, planData.hasSupport, planData.hasUpdates, planData.active, planData.unlimitedUsers, savings, new Date()]);
          }
        });
        synced++;
      } catch (err: any) {
        errors.push(`${db.environmentName}: ${err.message}`);
      }
    }

    return { synced, total: databases.length, errors };
  }

  async deletePlanFromProductEnvironments(productId: string, planName: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product?.projectId) return { deleted: 0 };

    const databases = await this.prisma.projectDatabase.findMany({
      where: { projectId: product.projectId },
    });

    let deleted = 0;
    for (const db of databases) {
      try {
        await this.withDb(db.databaseUrl, async (pool) => {
          await pool.query(`DELETE FROM plans WHERE name = $1`, [planName]);
        });
        deleted++;
      } catch {}
    }
    return { deleted, total: databases.length };
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
