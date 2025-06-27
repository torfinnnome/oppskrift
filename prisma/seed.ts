const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function generateRandomPassword(length: number): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { roles: { contains: 'admin' } },
  });

  if (!existingAdmin) {
    const password = generateRandomPassword(8);
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        displayName: 'Admin User',
        password: hashedPassword,
        isApproved: true,
        roles: 'admin',
      },
    });
    console.log(`
      --------------------------------------------------
      Default admin user created:
      Email: admin@example.com
      Password: ${password}
      --------------------------------------------------
    `);
  } else {
    console.log('Admin user already exists. Skipping seed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
