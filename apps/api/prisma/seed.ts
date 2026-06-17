import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@gestaoprime.com.br';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Seed já executado.');
    return;
  }

  const superAdmin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmX0rH4zK.KR7qYo8eW', // admin123
      name: 'Super Admin',
      role: 'super_admin',
      active: true,
    },
  });

  console.log('Super admin criado:', superAdmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
