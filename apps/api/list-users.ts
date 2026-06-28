import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:ciFEYUsNsexTEoviscaNmVHVjduDePNu@thomas.proxy.rlwy.net:40552/railway' } }
});
p.user.findMany({ select: { id: true, email: true, name: true, role: true } }).then(r => {
  console.log(JSON.stringify(r, null, 2));
  p.$disconnect();
});
