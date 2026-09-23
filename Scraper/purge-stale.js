/**
 * Delete listings that have not been seen in a recent scrape.
 *
 *   node Scraper/purge-stale.js --older-than 90            # report only
 *   node Scraper/purge-stale.js --older-than 90 --apply    # delete + VACUUM
 *
 * Why this exists
 * ---------------
 * Every scrape writes a full snapshot of the live inventory (~34.5k listings),
 * but rows are never removed, so dev.db accumulates listings that have since
 * been delisted. At the last audit, 82,853 of 117,993 cars (70%) had not been
 * seen in ANY recent scrape - and that number is identical whether you look back
 * 7, 14, 30, 90 or 180 days, i.e. they are stale from the pre-Algolia era rather
 * than gradually ageing out. Those rows were most of the ~99 MB.
 *
 * This is a data-destroying operation, so it is opt-in, dry-run by default, and
 * reports exactly what it would remove before touching anything.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dryRun = !apply;
const otIdx = argv.indexOf('--older-than');
const olderThanDays = otIdx !== -1 ? parseInt(argv[otIdx + 1], 10) : 90;

if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
  console.error('usage: node Scraper/purge-stale.js --older-than <days> [--apply]');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', 'prisma', 'prisma', 'dev.db');
const mb = (b) => (b / 1048576).toFixed(2) + ' MB';
const prisma = new PrismaClient();

async function main() {
  const sizeBefore = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const one = async (sql, ...params) => (await prisma.$queryRawUnsafe(sql, ...params))[0];

  const total = Number((await one('SELECT COUNT(*) AS n FROM Car')).n);
  const historyTotal = Number((await one('SELECT COUNT(*) AS n FROM CarHistory')).n);
  const newest = Number((await one('SELECT MAX(last_updated) AS m FROM Car')).m);
  const cutoff = new Date(newest - olderThanDays * 86400000);

  const doomed = Number((await one('SELECT COUNT(*) AS n FROM Car WHERE last_updated < ?', cutoff)).n);
  const doomedHistory = Number((await one(
    'SELECT COUNT(*) AS n FROM CarHistory WHERE listingId IN (SELECT listingId FROM Car WHERE last_updated < ?)',
    cutoff
  )).n);

  console.log(`database    : ${dbPath}`);
  console.log(`size        : ${mb(sizeBefore)}`);
  console.log(`cars        : ${total} (${historyTotal} history rows)`);
  console.log(`newest seen : ${new Date(newest).toISOString()}`);
  console.log(`cutoff      : ${cutoff.toISOString()}  (--older-than ${olderThanDays} days)`);
  console.log(`\nto delete   : ${doomed} cars (${((100 * doomed) / total).toFixed(1)}%)`);
  console.log(`              ${doomedHistory} history rows`);
  console.log(`to keep     : ${total - doomed} cars`);

  if (doomed === 0) {
    console.log('\nNothing to purge.');
    return;
  }

  if (dryRun) {
    const share = doomed / total;
    console.log(`\nestimated result: ~${mb(sizeBefore * (1 - share))} (from ~${mb(sizeBefore * share)} of stale data)`);
    console.log('\n--dry-run: nothing deleted. Re-run with --apply to purge.');
    return;
  }

  console.log('\ndeleting...');
  const t0 = Date.now();
  // CarHistory rows are removed explicitly: the relation is optional, so SQLite
  // has no ON DELETE CASCADE for it.
  const delHist = await prisma.$executeRawUnsafe(
    'DELETE FROM CarHistory WHERE listingId IN (SELECT listingId FROM Car WHERE last_updated < ?)',
    cutoff
  );
  const delCars = await prisma.$executeRawUnsafe('DELETE FROM Car WHERE last_updated < ?', cutoff);
  console.log(`  deleted ${delHist} history rows and ${delCars} cars in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log('running VACUUM...');
  await prisma.$executeRawUnsafe('VACUUM');

  const integrity = await one('PRAGMA integrity_check');
  const ok = integrity && Object.values(integrity)[0] === 'ok';
  const sizeAfter = fs.statSync(dbPath).size;
  const carsAfter = Number((await one('SELECT COUNT(*) AS n FROM Car')).n);
  const orphans = Number((await one(
    'SELECT COUNT(*) AS n FROM CarHistory h LEFT JOIN Car c ON c.listingId = h.listingId WHERE c.listingId IS NULL'
  )).n);

  console.log(`\n=== result ===`);
  console.log(`size        : ${mb(sizeBefore)} -> ${mb(sizeAfter)}  (saved ${mb(sizeBefore - sizeAfter)})`);
  console.log(`cars        : ${total} -> ${carsAfter}`);
  console.log(`orphans     : ${orphans}${orphans === 0 ? ' (none)' : ' (LEFTOVER HISTORY!)'}`);
  console.log(`integrity   : ${ok ? 'ok' : JSON.stringify(integrity)}`);

  if (orphans > 0) { console.error('\nERROR: orphan history rows remain.'); process.exit(1); }
  if (!ok) { console.error('\nERROR: integrity check failed.'); process.exit(1); }
  console.log('\nPurge complete. Run `npm run export:all && npm run sync:index` to rebuild index.html.');
}

main()
  .catch((e) => { console.error('An error occurred:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());