/**
 * Shared scaffolding for the save-to-db.js regression tests.
 *
 * `save-to-db.js` always imports from `Scraper/unprocessed/`, so a test has to
 * own that directory for the duration of its run. `withQueue` moves the real
 * queue aside before the test body and puts it back afterwards, even on failure.
 *
 * Each test passes its own `parking` directory. `Scraper/test-save-to-db.js` and
 * `Scraper/test-duplicates-in-file.js` therefore serialise on `unprocessed/`
 * rather than on a shared parking folder, so running them in either order (or
 * even at the same time) cannot strand the archive.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const unprocessed = path.join(__dirname, 'unprocessed');
const processed = path.join(__dirname, 'processed');
const schema = path.join(root, 'prisma', 'schema.prisma');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

/**
 * A sqlite URL both the Prisma CLI and the Prisma Client agree on.
 *
 * A RELATIVE url is resolved from the schema's directory by `prisma db push` but
 * from the process cwd by the client, so the two would create and open different
 * files ("The table `main.Car` does not exist"). An absolute `file:C:/...` url is
 * the only form that resolves identically for both - verified by probe:
 * `file:///C:/...` is rejected outright.
 */
function dbUrl(dbFile) {
  return 'file:' + path.resolve(dbFile).replace(/\\/g, '/');
}

/** Minimal pass/fail reporter; each test owns its own counters. */
function makeChecker() {
  const state = { passed: 0, failed: 0 };
  const check = (name, condition, detail = '') => {
    if (condition) { state.passed++; console.log(`  PASS  ${name}`); }
    else { state.failed++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
  };
  return { state, check };
}

/** Create a throwaway SQLite database at `dbFile` with the current schema. */
function createTestDb(dbFile) {
  destroyTestDb(dbFile);
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schema}`],
    { cwd: root, stdio: 'pipe', env: { ...process.env, DATABASE_URL: dbUrl(dbFile) } }
  );
  // Fail loudly here rather than as a confusing "table does not exist" later.
  if (!fs.existsSync(dbFile)) {
    throw new Error(`prisma db push did not create ${dbFile}`);
  }
}

/** Remove a throwaway database and its journal/wal siblings. */
function destroyTestDb(dbFile) {
  for (const s of ['', '-journal', '-wal', '-shm']) {
    const f = dbFile + s;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

/**
 * Run save-to-db.js against `dbFile` and parse its summary counters.
 * @returns {{out: string, added: number, updated: number, unchanged: number,
 *            skipped: number, statements: number, mergedRepeats: number}}
 */
function runSave(dbFile) {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'save-to-db.js')], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: dbUrl(dbFile) },
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const num = (label) => {
    const m = out.match(new RegExp(`${label}\\s*:\\s*(\\d+)`));
    return m ? parseInt(m[1], 10) : null;
  };
  return {
    out,
    added: num('Added'),
    updated: num('Updated'),
    unchanged: num('No changes'),
    skipped: num('Skipped'),
    mergedRepeats: num('Merged repeats'),
    statements: num('Statements used') ?? num('SQL statements used'),
  };
}

function client(dbFile) {
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: dbUrl(dbFile) } } });
}

/**
 * Run `body` with `Scraper/unprocessed/` owned by the test.
 *
 * Files the body writes are tracked and deleted afterwards, along with anything
 * save-to-db.js moved into `processed/`, so a failed assertion cannot leave
 * fixture files behind to be picked up by a later `npm run db:save`.
 */
async function withQueue(parking, body) {
  fs.mkdirSync(parking, { recursive: true });
  fs.mkdirSync(unprocessed, { recursive: true });

  const parked = fs.readdirSync(unprocessed);
  for (const f of parked) fs.renameSync(path.join(unprocessed, f), path.join(parking, f));

  const written = new Set();
  const write = (name, cars) => {
    written.add(name);
    fs.writeFileSync(path.join(unprocessed, name), JSON.stringify(cars));
  };

  try {
    return await body({ write, written });
  } finally {
    // Remove our fixtures first - once imported, they live in processed/.
    for (const f of written) {
      for (const dir of [unprocessed, processed]) {
        const p = path.join(dir, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    // Restore the real queue if the test dropped out of `withQueue` before the
    // import moved those files to processed/.
    for (const f of fs.readdirSync(parking)) {
      const from = path.join(parking, f);
      const dest = path.join(unprocessed, f);
      if (!fs.existsSync(dest)) fs.renameSync(from, dest);
    }
    // Whatever is still queued now is either restored archive or test debris.
    // Remove only the debris, so a concurrent db:seed cannot lose restored files.
    for (const f of fs.readdirSync(unprocessed)) {
      if (!written.has(f) && !parked.includes(f)) fs.unlinkSync(path.join(unprocessed, f));
    }
    fs.rmSync(parking, { recursive: true, force: true });
  }
}

module.exports = {
  root,
  unprocessed,
  processed,
  dbUrl,
  runSave,
  client,
  makeChecker,
  createTestDb,
  destroyTestDb,
  withQueue,
};
