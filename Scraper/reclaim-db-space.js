/**
 * Reclaim free space in the SQLite database.
 *
 *   node scraper/reclaim-db-space.js
 *
 * Runs `reclaim-db-space.sql` (a single `VACUUM`) through the Prisma Client.
 *
 * Why this exists
 * ---------------
 * The pipelines used to shell out to `npx prisma db execute --file
 * reclaim-db-space.sql`, which fails on Prisma 5.15 with
 *
 *   Error: SQLite database error
 *   unable to open database file
 *
 * before it ever runs the statement. That is the CLI's migrate engine, not the
 * database: `prisma validate`, `prisma migrate status` and every `@prisma/client`
 * query work fine, and the same VACUUM succeeds through the client. Because
 * `npm run db:seed` chains this as its last step, the failure surfaced as a
 * non-zero exit *after* a fully successful seed.
 *
 * VACUUM cannot run inside a transaction, so each statement is executed on its
 * own. Statements are split naively, which is all this file needs - it is a
 * single VACUUM - and the splitter keeps `--` comments from being sent as SQL.
 *
 * VACUUM is skipped (with a note) when it cannot help: SQLite itself rejects
 * `VACUUM` from inside a transaction, and there is nothing to reclaim when the
 * freelist is already empty. Reporting that is more useful than silently
 * rewriting the whole database file.
 */

require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const sqlFile = path.join(__dirname, '..', 'reclaim-db-space.sql');

/**
 * Strip `--` line comments and split on semicolons.
 *
 * Comment handling is deliberately strict: any line whose first non-space
 * characters are dashes is dropped whole. A loose `replace(/--.*$/)` is not
 * enough here, because the file comments each line with `--` twice
 * (`-- will help ...`), so one pass leaves a bare `--` that then eats the
 * following line and produces `near "will": syntax error`.
 */
function statementsOf(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);
}

function mb(bytes) {
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function main() {
  const sql = await fs.readFile(sqlFile, 'utf-8');
  const statements = statementsOf(sql);

  const [free] = await prisma.$queryRawUnsafe('PRAGMA freelist_count');
  const freePages = Number(free.freelist_count);
  const [before] = await prisma.$queryRawUnsafe('PRAGMA page_count');
  const pageSize = await prisma.$queryRawUnsafe('PRAGMA page_size');
  const bytesPerPage = Number(pageSize[0].page_size);
  const sizeBefore = Number(before.page_count) * bytesPerPage;

  console.log(`reclaim: ${statements.length} statement(s) from ${path.basename(sqlFile)}`);
  console.log(`  database size  : ${mb(sizeBefore)}`);
  console.log(`  free pages     : ${freePages} (${mb(freePages * bytesPerPage)} reclaimable)`);

  let ran = 0;
  for (const statement of statements) {
    const label = statement.split(/\s+/)[0].toUpperCase();
    if (label === 'VACUUM' && freePages === 0) {
      console.log('  VACUUM         : skipped - freelist is empty, nothing to reclaim');
      continue;
    }
    const started = Date.now();
    await prisma.$executeRawUnsafe(statement);
    ran++;
    console.log(`  ${label.padEnd(15)}: done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  if (ran) {
    const [after] = await prisma.$queryRawUnsafe('PRAGMA page_count');
    const sizeAfter = Number(after.page_count) * bytesPerPage;
    console.log(`  database size  : ${mb(sizeAfter)} (was ${mb(sizeBefore)})`);
  }
  console.log(`reclaim: ${ran ? `${ran} statement(s) applied` : 'nothing to do'}`);
}

main()
  .catch((error) => {
    console.error('reclaim failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
