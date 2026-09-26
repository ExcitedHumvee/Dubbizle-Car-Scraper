/**
 * Regression test for the batched save-to-db.js.
 *
 *   node Scraper/test-save-to-db.js
 *
 * Uses a throwaway SQLite database and a synthetic 300-car scrape file, then
 * asserts the three behaviours the optimization depends on:
 *   1. a fresh file inserts exactly its rows (+ one history row each)
 *   2. an identical re-import with a newer timestamp is a no-op for data,
 *      collapses to ONE updateMany, and adds NO history rows
 *   3. a re-import with changed price/mileage updates only those rows and adds
 *      exactly one history row per change
 *
 * Test "3" is the guard for the Date-comparison bug: `incoming !== existing` on
 * two Date objects is always true, which previously made every row look changed.
 *
 * Duplicate `listingId`s inside a single file are covered separately by
 * `Scraper/test-duplicates-in-file.js`.
 */

const path = require('path');
const {
  runSave,
  client,
  makeChecker,
  createTestDb,
  destroyTestDb,
  withQueue,
} = require('./test-helpers');

const dbFile = path.join(__dirname, 'diag', 'test-save.db');
const parking = path.join(__dirname, 'diag', 'parked-test-save');

const N = 300;
const CAR_COUNT_CHANGED = 25;

const { state, check } = makeChecker();

/** A synthetic row in the same shape export-cars-from-db.js produces. */
function makeCar(i, overrides = {}) {
  return {
    listingId: `test${String(i).padStart(28, '0')}`,
    make: 'Toyota',
    model: 'Corolla',
    year: 2015 + (i % 10),
    mileage: 50000 + i,
    price: 30000 + i,
    title: `Test Car ${i}`,
    spec: 'GCC',
    isPremium: i % 3 === 0 ? 1 : 0,
    bodyType: 'Sedan',
    engineCapacity: '1500 - 1999 cc',
    horsepower: '100 - 199 HP',
    transmissionType: 'Automatic Transmission',
    cylinders: 4,
    interiorColor: 'Black',
    exteriorColor: 'White',
    doors: '4 door',
    seatingCapacity: '5 Seater',
    trim: 'XLI',
    warranty: 'No',
    fuelType: 'Petrol',
    motorsTrim: 'XLI',
    sellerType: 'Owner',
    location: 'Deira, Dubai',
    neighbourhood: 'Al Muraqqabat',
    detailPageUrl: `https://dubai.dubizzle.com/motors/used-cars/toyota/corolla/x---test${i}/`,
    isNegotiable: 0,
    thumbnailUrl: 'https://dbz-images.dubizzle.com/x.jpeg',
    vehicleReference: null,
    isVerifiedUser: 0,
    createdAt: Date.UTC(2026, 0, 1) + i * 1000,
    added: Date.UTC(2026, 1, 1) + i * 1000,
    ...overrides,
  };
}

(async () => {
  console.log('save-to-db regression test');
  createTestDb(dbFile);

  try {
    await withQueue(parking, async ({ write }) => {
      const base = Array.from({ length: N }, (_, i) => makeCar(i));

      // ---------- 1. fresh insert ----------
      console.log('\n1. fresh insert');
      write(`2026-09-22T16-36-49-${N}.json`, base);
      const r1 = runSave(dbFile);
      let p = client(dbFile);
      let cars = await p.car.count();
      let hist = await p.carHistory.count();
      await p.$disconnect();
      check('inserts every car', cars === N, `expected ${N}, got ${cars}`);
      check('writes one history row per new car', hist === N, `expected ${N}, got ${hist}`);
      check('reports Added=' + N, r1.added === N, `got ${r1.added}`);

      // ---------- 2. identical re-import ----------
      console.log('\n2. identical re-import (newer timestamp)');
      write(`2026-09-22T17-00-00-${N}.json`, base);
      const r2 = runSave(dbFile);
      p = client(dbFile);
      cars = await p.car.count();
      hist = await p.carHistory.count();
      await p.$disconnect();
      check('no duplicate cars', cars === N, `expected ${N}, got ${cars}`);
      check('no new history rows', hist === N, `expected ${N}, got ${hist}`);
      check('nothing reported as changed', (r2.updated || 0) === 0, `Updated=${r2.updated}`);
      check('identical rows counted as unchanged', r2.unchanged === N, `No changes=${r2.unchanged}`);
      // Unchanged rows cost no SQL at all, so last_updated keeps meaning
      // "when this car's data last changed" (matching the original behaviour).
      check('uses no SQL statements', r2.statements === 0, `statements=${r2.statements}`);
      const touched = await (async () => {
        const q = client(dbFile);
        const row = await q.car.findFirst({ where: { listingId: base[0].listingId } });
        await q.$disconnect();
        return row.last_updated.toISOString();
      })();
      check('last_updated NOT bumped for identical data', touched.startsWith('2026-09-22T16:36:49'), `got ${touched}`);

      // ---------- 3. re-import with real changes ----------
      console.log('\n3. re-import with changed price/mileage');
      const changed = base.map((c, i) =>
        i < CAR_COUNT_CHANGED ? { ...c, price: c.price + 999, mileage: c.mileage + 111 } : c
      );
      write(`2026-09-22T18-00-00-${N}.json`, changed);
      const r3 = runSave(dbFile);
      p = client(dbFile);
      cars = await p.car.count();
      hist = await p.carHistory.count();
      const sample = await p.car.findUnique({ where: { listingId: base[0].listingId } });
      const untouched = await p.car.findUnique({ where: { listingId: base[N - 1].listingId } });
      await p.$disconnect();

      check('car count unchanged', cars === N, `expected ${N}, got ${cars}`);
      check(`only ${CAR_COUNT_CHANGED} rows reported changed`, r3.updated === CAR_COUNT_CHANGED, `Updated=${r3.updated}`);
      check('untouched rows are left alone', r3.unchanged === N - CAR_COUNT_CHANGED, `No changes=${r3.unchanged}`);
      // 1 statement per distinct change-set (these rows each carry a different
      // price/mileage, so each is its own group).
      check(
        'one statement per distinct change-set',
        r3.statements === CAR_COUNT_CHANGED,
        `statements=${r3.statements}`
      );
      check(`adds exactly ${CAR_COUNT_CHANGED} history rows`, hist === N + CAR_COUNT_CHANGED, `expected ${N + CAR_COUNT_CHANGED}, got ${hist}`);
      check('price actually updated', sample.price === base[0].price + 999, `got ${sample.price}`);
      check('mileage actually updated', sample.mileage === base[0].mileage + 111, `got ${sample.mileage}`);
      check('unrelated row left alone', untouched.price === base[N - 1].price, `got ${untouched.price}`);

      // ---------- 4. re-import an older file ----------
      console.log('\n4. older file is ignored');
      write(`2026-09-22T15-00-00-${N}.json`, base.map((c) => ({ ...c, price: 1 })));
      runSave(dbFile);
      p = client(dbFile);
      const afterOld = await p.car.findUnique({ where: { listingId: base[0].listingId } });
      const histAfterOld = await p.carHistory.count();
      await p.$disconnect();
      check('older file changes nothing', afterOld.price !== 1, `price became ${afterOld.price}`);
      check('older file adds no history', histAfterOld === N + CAR_COUNT_CHANGED, `expected ${N + CAR_COUNT_CHANGED}, got ${histAfterOld}`);
    });
  } finally {
    destroyTestDb(dbFile);
  }

  console.log(`\n${state.passed} passed, ${state.failed} failed`);
  process.exit(state.failed === 0 ? 0 : 1);
})().catch((e) => { console.error('\nTEST ERROR:', e.stack || e.message); process.exit(1); });
