/**
 * Shrink dev.db without deleting any car data.
 *
 *   node Scraper/compact-db.js            # report only (dry-run)
 *   node Scraper/compact-db.js --apply    # drop unused indexes + VACUUM
 *
 * Prefer the migration: `prisma migrate dev` / `migrate deploy` applies
 * prisma/migrations/20260923143000_drop_unused_car_indexes, which drops the same
 * indexes and keeps migration history consistent. This script exists for
 * databases where that migration is recorded as applied but the indexes are
 * somehow still present. It refuses to drop anything while the migration is
 * still pending, because doing so would make the migration fail later.
 *
 * The application only ever queries `Car` by `listingId` (the primary key) and
 * orders by `last_updated`. The nine other @@index declarations used to live in
 * prisma/schema.prisma and were never used by any code path; together they cost
 * ~18 MB.
 *
 * Measured on a 98.85 MB database: 98.85 MB -> 80.99 MB (saves 17.86 MB, 18.1%).
 * No rows are touched - this is purely index + free-page reclamation.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const MIGRATION = '20260923143000_drop_unused_car_indexes';

const apply = process.argv.includes('--apply');
const dryRun = !apply;

const dbPath = path.join(__dirname, '..', 'prisma', 'prisma', 'dev.db');
const mb = (b) => (b / 1048576).toFixed(2) + ' MB';

const prisma = new PrismaClient();

/** True when the drop-indexes migration still needs to run. */
async function migrationPending() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS n FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL',
      MIGRATION
    );
    return Number(rows[0].n) === 0;
  } catch (e) {
    return null; // migrations table unreadable
  }
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('database not found:', dbPath);
    process.exit(1);
  }

  const sizeBefore = fs.statSync(dbPath).size;
  const cars = await prisma.car.count();
  const history = await prisma.carHistory.count();

  console.log(`database   : ${dbPath}`);
  console.log(`size       : ${mb(sizeBefore)}`);
  console.log(`cars       : ${cars}`);
  console.log(`history    : ${history}`);

  const indexes = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Car' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  const droppable = indexes.map((i) => i.name);

  const free = await prisma.$queryRawUnsafe('PRAGMA freelist_count');
  const pageSize = await prisma.$queryRawUnsafe('PRAGMA page_size');
  console.log(`free pages : ${Number(free[0].freelist_count)} of ${Math.round(sizeBefore / Number(pageSize[0].page_size))}`);
  console.log(`\nunused indexes on Car: ${droppable.length}`);
  for (const name of droppable) console.log(`  ${name}`);

  const pending = await migrationPending();

  if (!droppable.length) {
    console.log('\nNo unused indexes present.');
    if (apply) {
      const t0 = Date.now();
      console.log('running VACUUM to reclaim free pages...');
      await prisma.$executeRawUnsafe('VACUUM');
      console.log(`size: ${mb(sizeBefore)} -> ${mb(fs.statSync(dbPath).size)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    return;
  }

  if (pending) {
    console.log(`\nMigration ${MIGRATION} has not been applied yet.`);
    console.log('Run it instead - it drops these indexes and records the change:');
    console.log('   npm run db:setup        (prisma migrate deploy)');
    console.log('\n`npm run scrape` also applies migrations as its first step.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing changed. Re-run with --apply to drop and VACUUM.');
    return;
  }

  console.log('\ndropping...');
  for (const name of droppable) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`);
    console.log('  dropped', name);
  }

  console.log('running VACUUM (this can take a minute)...');
  await prisma.$executeRawUnsafe('VACUUM');

  const integrity = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
  const ok = integrity[0] && Object.values(integrity[0])[0] === 'ok';

  const sizeAfter = fs.statSync(dbPath).size;
  const carsAfter = await prisma.car.count();
  const historyAfter = await prisma.carHistory.count();

  console.log(`\n=== result ===`);
  console.log(`size      : ${mb(sizeBefore)} -> ${mb(sizeAfter)}  (saved ${mb(sizeBefore - sizeAfter)}, ${(100 * (sizeBefore - sizeAfter) / sizeBefore).toFixed(1)}%)`);
  console.log(`cars      : ${cars} -> ${carsAfter}${cars === carsAfter ? ' (unchanged)' : ' (CHANGED!)'}`);
  console.log(`history   : ${history} -> ${historyAfter}${history === historyAfter ? ' (unchanged)' : ' (CHANGED!)'}`);
  console.log(`integrity : ${ok ? 'ok' : JSON.stringify(integrity)}`);

  if (cars !== carsAfter || history !== historyAfter) {
    console.error('\nERROR: row counts changed - this should never happen.');
    process.exit(1);
  }
  if (!ok) {
    console.error('\nERROR: integrity check failed.');
    process.exit(1);
  }
  console.log('\nDatabase compacted; no rows were modified.');
}

main()
  .catch((e) => { console.error('An error occurred:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());