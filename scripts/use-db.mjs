// ===========================================================================
// use-db — สลับฐานข้อมูลของ Prisma ระหว่าง SQLite (dev) กับ PostgreSQL (production)
//
//   node scripts/use-db.mjs sqlite     → provider "sqlite" + file:./dev.db (ค่าเริ่มต้น dev)
//   node scripts/use-db.mjs postgres   → provider "postgresql" + url จาก env DATABASE_URL
//                                        (รัน prisma generate ให้ด้วยหลังสลับ)
//
// หลังสลับเป็น postgres:
//   cd apps/server
//   DATABASE_URL="postgresql://cardwar:cardwar@localhost:5432/cardwar?schema=public" npx prisma db push
//   DATABASE_URL="postgresql://..." npm run db:seed
//   DATABASE_URL="postgresql://..." npm run start
// ===========================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'apps', 'server', 'prisma', 'schema.prisma');
const target = process.argv[2];

if (target !== 'sqlite' && target !== 'postgres') {
  console.error('วิธีใช้: node scripts/use-db.mjs sqlite|postgres');
  process.exit(1);
}

const src = readFileSync(schemaPath, 'utf8');
const block = target === 'sqlite'
  ? 'datasource db {\n  provider = "sqlite"\n  url      = "file:./dev.db"\n}'
  : 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}';

const next = src.replace(
  /datasource db \{[^}]*\}/,
  block,
);
if (next.includes(`provider = "${target === 'sqlite' ? 'postgresql' : 'sqlite'}"`)) {
  // ไม่ควรเกิด — regex ไม่ match
  console.error('ไม่พบ datasource block ใน schema.prisma');
  process.exit(1);
}
const already = next === src;
if (!already) writeFileSync(schemaPath, next);
console.log(already
  ? `schema เป็น ${target === 'sqlite' ? 'SQLite (dev)' : 'PostgreSQL (production)'} อยู่แล้ว — กำลัง prisma generate...`
  : `สลับ schema เป็น ${target === 'sqlite' ? 'SQLite (dev)' : 'PostgreSQL (production)'} แล้ว — กำลัง prisma generate...`);

const r = spawnSync('npx', ['prisma', 'generate', `--schema=${schemaPath}`], {
  cwd: path.join(root, 'apps', 'server'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 0);
