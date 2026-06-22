const { PrismaClient } = require('@prisma/client');

const urls = [
  'postgresql://postgres:ciFEYUsNsexTEoviscaNmVHVjduDePNu@thomas.proxy.rlwy.net:40552/railway',
  'postgresql://postgres:ciFEYUsNsexTEoviscaNmVHVjduDePNu@thomas.proxy.rlwy.net:40552/railway?sslmode=require',
  'postgresql://postgres:ciFEYUsNsexTEoviscaNmVHVjduDePNu@thomas.proxy.rlwy.net:40552/railway?sslmode=no-verify',
  'postgresql://postgres:ciFEYUsNsexTEoviscaNmVHVjduDePNu@thomas.proxy.rlwy.net:40552/railway?sslmode=prefer',
];

(async () => {
  for (const url of urls) {
    try {
      const p = new PrismaClient({ datasources: { db: { url } } });
      await p.$connect();
      console.log('OK:', url.substring(0, 80));
      await p.$disconnect();
    } catch (e) {
      console.log('FAIL:', url.substring(0, 80));
      console.log('  ->', e.message?.substring(0, 100));
    }
  }
})();
