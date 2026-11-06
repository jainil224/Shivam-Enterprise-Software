import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe("SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at");
console.log(rows.map(r => `${r.migration_name} | ${r.finished_at}`).join('\n'));
const t = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
console.log('TABLES:', t.map(r => r.table_name).join(', '));
await p.$disconnect();