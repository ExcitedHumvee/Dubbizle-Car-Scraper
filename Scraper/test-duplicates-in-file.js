/**
 * Regression test for duplicate `listingId`s inside ONE scrape file.
 *
 *   node Scraper/test-duplicates-in-file.js
 *
 * Why this exists
 * ---------------
 * The Algolia partitions overlap, so a car reachable from two partitions is
 * returned by both and the scrape file lists it twice. 91 of the 162 archived
 * runs do this (146,582 repeated ids, ~297k redundant rows). `save-to-db.js` used
 * to plan each occurrence separately, so a listing seen twice in one file was
 * queued for `createMany` twice and the whole chunk died with:
 *
 *   PrismaClientKnownRequestError: Unique constraint failed on the fields: (`listingId`)
 *
 * which aborted `npm run db:seed` on a fresh clone. This test pins the fix:
 *   1. a file with repeats imports cleanly, one row per distinct listing
 *   2. repeats do not inflate the reported counts and are reported as merged
 *   3. exactly one CarHistory row per new listing, even with repeats
 *   4. a repeat carrying data the first occurrence lacked fills the gap
 *      (nulls still never clobber real values)
 *   5. a later file still updates normally after a file full of repeats
 *
 * Uses a throwaway SQLite database; the real import queue is parked and restored.
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

const dbFile = path.join(__dirname, 'diag', 'test-duplicates.db');
const parking = path.join(__dirname, 'diag', 'parked-test-duplicates');

const { state, check } = makeChecker();

/** A synthetic row in the same shape export-cars-from-db.js produces. */
function makeCar(i, overrides = {}) {
  return {
    listingId: `dup${String(i).padStart(28, '0')}`,
    make: 'Toyota',
    model: 'Corolla',
    year: 2015 + (i % 10),
    mileage: 50000 + i,
    price: 30000 + i,
    title: `Duplicate Car ${i}`,
    spec: 'GCC',
    isPremium: 0,
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
    detailPageUrl: `https://dubai.dubizzle.com/motors/used-cars/toyota/corolla/x---dup${i}/`,
    isNegotiable: 0,
    thumbnailUrl: 'https://dbz-images.dubizzle.com/x.jpeg',
    vehicleReference: null,
    isVerifiedUser: 0,
    createdAt: Date.UTC(2026, 0, 1) + i * 1000,
    added: Date.UTC(2026, 1, 1) + i * 1000,
    ...overrides,
  };
}

const N = 120;              // distinct listings
const REPEAT_EVERY = 3;     // every 3rd listing appears twice

(async () => {
  console.log('save-to-db duplicate-listing regression test');
  createTestDb(dbFile);

  try {
    await withQueue(parking, async ({ write }) => {
      // ---------- 1. one file, many repeats ----------
      console.log('\n1. a file that lists the same cars twice');

      const base = Array.from({ length: N }, (_, i) => makeCar(i));
      // Interleave exact duplicates to mimic how overlapping partitions produce
      // them - the second copy is byte identical to the first.
      const withRepeats = [];
      let repeats = 0;
      base.forEach((car, i) => {
        withRepeats.push(car);
        if (i % REPEAT_EVERY === 0) { withRepeats.push({ ...car }); repeats++; }
      });

      const f1 = `2026-09-22T16-36-49-${withRepeats.length}.json`;
      write(f1, withRepeats);

      const r1 = runSave(dbFile);
      let p = client(dbFile);
      let cars = await p.car.count();
      let hist = await p.carHistory.count();
      await p.$disconnect();

      check('import completes despite repeats', r1.added === N, `Added=${r1.added}, expected ${N}`);
      check('one row per distinct listing', cars === N, `expected ${N}, got ${cars}`);
      check('repeats are not reported as cars', r1.unchanged === 0, `No changes=${r1.unchanged}`);
      check('repeats are reported as merged', r1.mergedRepeats === repeats, `Merged repeats=${r1.mergedRepeats}, expected ${repeats}`);
      check('exactly one history row per new listing', hist === N, `expected ${N}, got ${hist}`);

      // ---------- 2. gap-filling repeat ----------
      // An older archived file can hold two complementary rows for one listing:
      // one with the price, one with the mileage. First occurrence wins, the
      // repeat may only fill what was null.
      console.log('\n2. a repeat that carries data the first occurrence lacked');

      const gapId = 'gapfill0000000000000000000000';
      const f2 = `2026-09-22T17-00-00-8.json`;
      write(f2, [
        makeCar(0, { listingId: gapId, price: 41000, mileage: null, trim: null }),
        makeCar(1, { listingId: gapId, price: null, mileage: 77777, trim: 'GLI' }),
        makeCar(2, { listingId: gapId, price: 99999 }), // must not replace 41000
      ]);

      const r2 = runSave(dbFile);
      p = client(dbFile);
      const gapRow = await p.car.findUnique({ where: { listingId: gapId } });
      const gapHist = await p.carHistory.count({ where: { listingId: gapId } });
      const afterGap = await p.car.count();
      await p.$disconnect();

      check('only the new listing is added', r2.added === 1, `Added=${r2.added}, expected 1`);
      check('gap-filling repeat is inserted once', afterGap === N + 1, `expected ${N + 1}, got ${afterGap}`);
      check('first occurrence keeps the price', gapRow.price === 41000, `price=${gapRow.price}`);
      check('repeat fills the missing mileage', gapRow.mileage === 77777, `mileage=${gapRow.mileage}`);
      check('repeat fills the missing trim', gapRow.trim === 'GLI', `trim=${gapRow.trim}`);
      check('later repeat does not overwrite real data', gapRow.price === 41000, `price=${gapRow.price}`);
      check('only one history row for the merged listing', gapHist === 1, `expected 1, got ${gapHist}`);

      // ---------- 3. later files still apply updates ----------
      console.log('\n3. a later file still updates after a file full of repeats');

      const bumped = base.map((c, i) => (i < 10 ? { ...c, price: c.price + 500 } : c));
      const f3 = `2026-09-22T18-00-00-${bumped.length}.json`;
      write(f3, bumped);

      const r3 = runSave(dbFile);
      p = client(dbFile);
      const sample = await p.car.findUnique({ where: { listingId: base[0].listingId } });
      const finalCars = await p.car.count();
      await p.$disconnect();

      check('only the 10 changed rows update', r3.updated === 10, `Updated=${r3.updated}`);
      check('updated price is stored', sample.price === base[0].price + 500, `got ${sample.price}`);
      check('no rows duplicated by the update', finalCars === N + 1, `expected ${N + 1}, got ${finalCars}`);
    });
  } finally {
    destroyTestDb(dbFile);
  }

  console.log(`\n${state.passed} passed, ${state.failed} failed`);
  process.exit(state.failed === 0 ? 0 : 1);
})().catch((e) => { console.error('\nTEST ERROR:', e.stack || e.message); process.exit(1); });
