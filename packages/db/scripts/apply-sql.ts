import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, '..', 'sql');

async function main() {
  const url = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATIONS or DATABASE_URL required');

  const prisma = new PrismaClient({ datasourceUrl: url });

  const files = readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(sqlDir, file), 'utf8');
    console.log(`▶ applying ${file}`);
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}:`, err);
      throw err;
    }
  }

  await prisma.$disconnect();
  console.log('✓ all SQL applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
