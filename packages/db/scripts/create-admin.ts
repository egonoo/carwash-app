import { PrismaClient, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import 'dotenv/config';

function arg(name: string, fallback?: string): string {
  const i = process.argv.findIndex((a) => a === `--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

async function main() {
  const email = arg('email', 'owner@demo.splash.app').toLowerCase();
  const password = arg('password', 'ChangeMe123!');
  const businessSlug = arg('business-slug', 'demo');
  const role = arg('role', 'owner') as UserRole;
  const fullName = arg('name', 'Demo Owner');

  const prisma = new PrismaClient();

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) {
    throw new Error(`Business with slug "${businessSlug}" not found. Run pnpm db:seed first.`);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.appUser.upsert({
    where: { email },
    update: { passwordHash, fullName },
    create: { email, passwordHash, fullName, emailVerifiedAt: new Date() },
  });

  await prisma.userBusinessRole.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: { role },
    create: { userId: user.id, businessId: business.id, role },
  });

  console.log(`✓ admin ready`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  business: ${business.name} (${business.slug})`);
  console.log(`  role:     ${role}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
