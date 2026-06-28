import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

interface TenantConnection {
  pool: Pool;
  lastUsed: number;
}

@Injectable()
export class TenantDbService {
  private readonly logger = new Logger(TenantDbService.name);
  private connections = new Map<string, TenantConnection>();
  private readonly MAX_POOLS = 50;
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000;

  async getClient(tenantId: string, databaseUrl: string): Promise<PoolClient> {
    let conn = this.connections.get(tenantId);

    if (!conn) {
      if (this.connections.size >= this.MAX_POOLS) {
        this.evictIdleConnections();
      }

      const pool = new Pool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        ssl: { rejectUnauthorized: false },
      });

      conn = { pool, lastUsed: Date.now() };
      this.connections.set(tenantId, conn);
    }

    conn.lastUsed = Date.now();
    try {
      return await conn.pool.connect();
    } catch (err) {
      this.connections.delete(tenantId);
      await conn.pool.end().catch(() => {});
      throw err;
    }
  }

  async runQuery(tenantId: string, databaseUrl: string, query: string, params?: unknown[]) {
    const client = await this.getClient(tenantId, databaseUrl);
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  async runMigrations(tenantId: string, databaseUrl: string, schemaName?: string) {
    const schema = schemaName || `tenant_${tenantId.replace(/-/g, '_').slice(0, 20)}`;

    const sql = `
      CREATE SCHEMA IF NOT EXISTS "${schema}";

      SET search_path TO "${schema}";

      CREATE TABLE IF NOT EXISTS "${schema}".clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        document VARCHAR(20),
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        responsible VARCHAR(255),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255),
        logo TEXT,
        address TEXT,
        document VARCHAR(20),
        phones TEXT[],
        email VARCHAR(255),
        pix_key VARCHAR(255),
        theme VARCHAR(50) DEFAULT 'white',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(50),
        client_name VARCHAR(255),
        total DECIMAL(10,2),
        pdf_data TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plate VARCHAR(20) NOT NULL,
        model VARCHAR(255),
        brand VARCHAR(255),
        year INTEGER,
        capacity INTEGER,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        document VARCHAR(20),
        cnh VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".service_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID REFERENCES "${schema}".clients(id),
        vehicle_id UUID REFERENCES "${schema}".vehicles(id),
        driver_id UUID REFERENCES "${schema}".drivers(id),
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        value DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".agenda_servicos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ,
        client_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        concluded BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        data TEXT NOT NULL,
        mime_type VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schema}".subscription (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id VARCHAR(255) NOT NULL,
        plan_name VARCHAR(255),
        plan_daily_rate INTEGER DEFAULT 0,
        plan_validity_days INTEGER DEFAULT 30,
        plan_price INTEGER DEFAULT 0,
        plan_discount INTEGER DEFAULT 0,
        plan_discounted_price INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'trial',
        starts_at TIMESTAMPTZ DEFAULT NOW(),
        ends_at TIMESTAMPTZ NOT NULL,
        cancelled_at TIMESTAMPTZ,
        validity_days INTEGER DEFAULT 0,
        max_users INTEGER DEFAULT 1,
        unlimited_users BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Migrate existing tables: add columns if missing (idempotent)
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_id VARCHAR(255) NOT NULL DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_daily_rate INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_validity_days INTEGER DEFAULT 30;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_price INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_discount INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS plan_discounted_price INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE "${schema}".subscription ADD COLUMN IF NOT EXISTS unlimited_users BOOLEAN DEFAULT false;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

      -- Copy data from old columns (start_date/end_date) to new columns (starts_at/ends_at)
      DO $$ BEGIN
        UPDATE "${schema}".subscription SET starts_at = start_date::timestamptz WHERE starts_at IS NULL AND start_date IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        UPDATE "${schema}".subscription SET ends_at = end_date::timestamptz WHERE ends_at IS NULL AND end_date IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
    `;

    return this.runQuery(tenantId, databaseUrl, sql);
  }

  private evictIdleConnections() {
    const now = Date.now();
    for (const [id, conn] of this.connections.entries()) {
      if (now - conn.lastUsed > this.IDLE_TIMEOUT) {
        conn.pool.end().catch(() => {});
        this.connections.delete(id);
      }
    }
  }
}
