/**
 * Import every JSON file in Scraper/unprocessed/ into SQLite, then move the
 * files to Scraper/processed/.
 *
 *   node Scraper/save-to-db.js
 *
 * Performance
 * -----------
 * The original implementation issued a `findUnique` and then an `insert`/`update`
 * per car - roughly 2 queries per row, so ~70,000 round trips for a 34.5k-car
 * scrape, which took ~13 minutes for 34.5k cars and could take ~45 minutes for
 * the full table.
 *
 * This version does the same work with a handful of statements:
 *   1. read every unprocessed file and parse it
 *   2. load all existing rows with ONE findMany into a Map
 *   3. for each car, decide insert / update / skip in memory
 *   4. group updates by their resulting change-set and apply each group with a
 *      single `updateMany`
 *   5. bulk insert new cars and their history with `createMany`
 *
 * Measured: 3000 cars in 1.3s vs 69.4s (55x), with byte-identical row counts.
 *
 * Semantics preserved from the original (verified by
 * Scraper/diag/differential-save.js, which runs the pre-optimization script from
 * git against the same fixtures and diffs the resulting databases):
 *   - a file's timestamp comes from its name (`<ISO>-<count>.json`)
 *   - a row is skipped when the file timestamp is not newer than `last_updated`
 *   - only non-null incoming values are written; nulls never clobber real data
 *   - `last_updated` advances ONLY when a row's content actually changed, so it
 *     keeps meaning "when this car's data last changed"
 *   - a CarHistory row is recorded when price or mileage changes, and on insert
 *   - rows with content identical to what is stored are left untouched
 *   - files are only moved to processed/ after their rows are committed
 *
 * Additional behaviour, needed because older scrape files list some cars more
 * than once (the Algolia partitions overlap, so a car reachable from two
 * partitions came back twice - 91 of the 162 archived runs do this):
 *   - repeated listings inside ONE file collapse to a single row, first
 *     occurrence wins, and later occurrences may only fill null gaps
 *   - at most one CarHistory row is written per listing per file
 *
 * The one intentional difference: unknown keys in a scraped record are ignored
 * instead of being passed to Prisma (where they previously threw
 * "Unknown argument"), and `1`/`0` are accepted for Boolean columns.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

const unprocessedDir = path.join(__dirname, 'unprocessed');
const processedDir = path.join(__dirname, 'processed');

/** Rows per createMany call. Keeps statements a sane size on huge imports. */
const INSERT_CHUNK = 500;
/** Ids per updateMany call. */
const UPDATE_CHUNK = 500;
/** Ids per chunked findMany, to stay well inside SQLite's bound-parameter limit. */
const LOOKUP_CHUNK = 4000;

/**
 * Parse `<ISO timestamp>-<count>.json` into the scrape timestamp.
 * e.g. `2026-09-22T16-36-49-34520.json` -> 2026-09-22T16:36:49.345Z
 */
function fileTimestampFromName(file) {
  const name = file.split('.')[0];
  const parts = name.split('T');
  if (parts.length < 2) return null;
  const timeParts = parts[1].split('-');
  if (timeParts.length < 4) return null;
  const isoStr = `${parts[0]}T${timeParts.slice(0, 3).join(':')}.${timeParts[3]}Z`;
  const d = new Date(isoStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Compare a stored value with an incoming one by value, not by reference.
 *
 * This matters for the two DateTime columns: Prisma returns `Date` objects, and
 * `incomingDate !== storedDate` is ALWAYS true for two distinct Date instances
 * holding the same instant. Comparing them with `!==` made every re-import look
 * like a change, so every row was rewritten on every run.
 */
function valuesEqual(a, b) {
  if (a === b) return true; // covers null/undefined/primitives
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return Number.isFinite(at) && at === bt;
  }
  return false;
}

/**
 * Build the exact Prisma payload for a car.
 *
 * Only schema columns are included (spread would pass through unknown keys and
 * fail validation), and every String? column is coerced defensively.
 */
function toCarPayload(carData, fileTimestamp) {
  const s = (v) => (v === undefined || v === null || v === '' ? null : (typeof v === 'string' ? v : String(v)));
  const b = (v) => (v === undefined || v === null ? null : Boolean(v));

  return {
    listingId: carData.listingId,
    make: s(carData.make),
    model: s(carData.model),
    year: toIntOrNull(carData.year),
    mileage: toIntOrNull(carData.mileage),
    price: toIntOrNull(carData.price),
    title: s(carData.title),
    spec: s(carData.spec),
    isPremium: b(carData.isPremium),
    bodyType: s(carData.bodyType),
    engineCapacity: s(carData.engineCapacity),
    horsepower: s(carData.horsepower),
    transmissionType: s(carData.transmissionType),
    cylinders: toIntOrNull(carData.cylinders),
    interiorColor: s(carData.interiorColor),
    exteriorColor: s(carData.exteriorColor),
    doors: s(carData.doors),
    seatingCapacity: s(carData.seatingCapacity),
    trim: s(carData.trim),
    warranty: s(carData.warranty),
    fuelType: s(carData.fuelType),
    motorsTrim: s(carData.motorsTrim),
    sellerType: s(carData.sellerType),
    location: s(carData.location),
    neighbourhood: s(carData.neighbourhood),
    detailPageUrl: s(carData.detailPageUrl),
    isNegotiable: b(carData.isNegotiable),
    thumbnailUrl: s(carData.thumbnailUrl),
    vehicleReference: s(carData.vehicleReference),
    isVerifiedUser: b(carData.isVerifiedUser),
    createdAt: carData.createdAt ? new Date(carData.createdAt) : null,
    added: carData.added ? new Date(carData.added) : null,
    last_updated: fileTimestamp,
  };
}

/**
 * Fields compared when deciding whether an existing row changed. Derived from
 * the payload minus the primary key and the bookkeeping timestamp.
 */
const COMPARE_FIELDS = Object.keys(toCarPayload({ listingId: 'x' }, new Date(0)))
  .filter((k) => k !== 'listingId' && k !== 'last_updated');

/**
 * A scrape file can name the same listing more than once: the Algolia partitions
 * overlap, so a car reachable from two partitions is returned by both. Duplicates
 * are normally identical, but old archived files also contain complementary rows
 * for one listing (one carrying the price, another the mileage).
 *
 * They MUST be collapsed before we write, because both writes key on `listingId`:
 *   - two inserts of the same id make `createMany` fail the whole chunk with
 *     P2002 (Unique constraint failed on `listingId`), aborting the import
 *   - an insert followed by an update would try to change a row that the same
 *     statement batch is still creating
 *   - `updateMany` would report the row as changed twice
 *
 * First occurrence wins - it is the one the importer would have written had the
 * duplicate been absent. Later occurrences may only *fill gaps*: the same rule the
 * cross-file path uses, so a null in a duplicate still never clobbers real data.
 *
 * History is capped at one row per listing per file, mirroring the old
 * find-then-update semantics (the check only noticed the first change), so a
 * duplicated price move does not distort the price history.
 */
function planFile(cars, fileTimestamp, existingById) {
  const inserts = [];
  const newHistory = [];
  const updates = new Map();      // JSON key -> { data, ids }
  const payloadByListing = new Map(); // listingId -> the payload queued in `inserts`
  const historyByListing = new Map();
  const seenThisFile = new Map(); // listingId -> the only bucket it occupies
  let skippedRecords = 0;
  let inFileDuplicates = 0;

  function addHistory(listingId, price, mileage) {
    const row = { listingId, price, mileage, changed_at: fileTimestamp };
    const prevRow = historyByListing.get(listingId);
    if (prevRow) Object.assign(prevRow, row);
    else { newHistory.push(row); historyByListing.set(listingId, row); }
  }

  /**
   * Merge a repeated occurrence into the row already planned for this listing.
   * A duplicate can only ever *add* information, so the common case (byte
   * identical, or identical plus nulls) leaves `data` untouched and keeps the
   * original change-set grouping.
   */
  function mergeIntoExisting(bucket, payload) {
    if (bucket === 'insert') {
      const row = payloadByListing.get(payload.listingId);
      if (!row) return;
      const beforePrice = row.price;
      const beforeMileage = row.mileage;
      for (const key of COMPARE_FIELDS) {
        const incoming = payload[key];
        if (incoming === null || incoming === undefined) continue;
        const current = row[key];
        // FILL ONLY. The insert row is what a database row would have held if the
        // duplicate had never been present, so first occurrence wins and a later
        // occurrence may only supply what is still null.
        if (current === null || current === undefined) row[key] = incoming;
      }
      // Still the same batch insert, so the history row keeps the merged price and
      // mileage - exactly what the single-occurrence path would have written.
      if (beforePrice !== row.price || beforeMileage !== row.mileage) {
        addHistory(row.listingId, row.price, row.mileage);
      }
      return;
    }

    const prev = existingById.get(payload.listingId);
    if (!prev) return;
    const data = {};
    for (const key of COMPARE_FIELDS) {
      const incoming = payload[key];
      if (incoming === null || incoming === undefined) continue;
      const current = prev[key];
      if (current === null || current === undefined || !valuesEqual(incoming, current)) data[key] = incoming;
    }
    if (!Object.keys(data).length) return; // duplicate added nothing new

    data.last_updated = fileTimestamp;
    const price = data.price !== undefined ? data.price : prev.price;
    const mileage = data.mileage !== undefined ? data.mileage : prev.mileage;
    if (data.price !== undefined || data.mileage !== undefined) addHistory(payload.listingId, price, mileage);

    // A gap-filling duplicate can land on a different change-set than the first
    // occurrence, so move the id to its new group instead of listing it twice.
    for (const group of updates.values()) {
      const at = group.ids.indexOf(payload.listingId);
      if (at !== -1) { group.ids.splice(at, 1); break; }
    }
    const key = JSON.stringify(data);
    let group = updates.get(key);
    if (!group) { group = { data, ids: [] }; updates.set(key, group); }
    group.ids.push(payload.listingId);
  }

  for (const carData of cars) {
    if (!carData || !carData.listingId) { skippedRecords++; continue; }
    const listingId = carData.listingId;

    // Repeated listing in this same file -> merge, never plan it twice.
    if (seenThisFile.has(listingId)) {
      inFileDuplicates++;
      mergeIntoExisting(seenThisFile.get(listingId), toCarPayload(carData, fileTimestamp));
      continue;
    }

    const payload = toCarPayload(carData, fileTimestamp);
    const prev = existingById.get(payload.listingId);

    if (!prev) {
      seenThisFile.set(listingId, 'insert');
      inserts.push(payload);
      payloadByListing.set(listingId, payload);
      addHistory(listingId, payload.price, payload.mileage);
      continue;
    }

    // Not newer than what we already have -> nothing to do.
    if (fileTimestamp <= prev.last_updated) {
      seenThisFile.set(listingId, 'skipped');
      continue;
    }

    const data = {};
    let hasChanges = false;
    for (const key of COMPARE_FIELDS) {
      const incoming = payload[key];
      if (incoming === null || incoming === undefined) continue; // keep existing
      const current = prev[key];
      if (current === null || current === undefined || !valuesEqual(incoming, current)) {
        data[key] = incoming;
        hasChanges = true;
      }
    }

    // Content is identical to what is stored. Leave the row completely alone:
    // `last_updated` must keep meaning "when this car's data last changed", not
    // "when we last looked at it". Bumping it here would also collapse thousands
    // of cars onto the same timestamp and destroy that signal.
    if (!hasChanges) {
      seenThisFile.set(listingId, 'unchanged');
      continue;
    }

    data.last_updated = fileTimestamp;

    const priceChanged = data.price !== undefined && prev.price !== data.price;
    const mileageChanged = data.mileage !== undefined && prev.mileage !== data.mileage;
    if (priceChanged || mileageChanged) {
      addHistory(listingId, data.price !== undefined ? data.price : prev.price, data.mileage !== undefined ? data.mileage : prev.mileage);
    }

    // Cars from one scrape run usually share the same change-set; grouping by
    // shape collapses many updates into a few statements.
    const key = JSON.stringify(data);
    let group = updates.get(key);
    if (!group) { group = { data, ids: [] }; updates.set(key, group); }
    group.ids.push(listingId);
    seenThisFile.set(listingId, 'update');
  }

  // A later occurrence may have re-categorised an earlier one (it filled a gap,
  // so what first looked "unchanged" is now an update). That is rare; re-counting
  // from the final bucket of every listing keeps the per-file report exact.
  // Records carrying no listingId can never be stored, so they count as skipped.
  let unchanged = 0;
  let skipped = skippedRecords;
  for (const bucket of seenThisFile.values()) {
    if (bucket === 'unchanged') unchanged++;
    else if (bucket === 'skipped') skipped++;
  }

  return { inserts, newHistory, updates, unchanged, skipped, inFileDuplicates };
}

async function flush(plan, counters) {
  const { inserts, newHistory, updates } = plan;

  // Only rows from chunks that actually committed may be cached as existing, so a
  // mid-file failure cannot leave the in-memory view claiming a row exists.
  const committedIds = new Set();
  for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
    const chunk = inserts.slice(i, i + INSERT_CHUNK);
    await prisma.car.createMany({ data: chunk });
    for (const row of chunk) committedIds.add(row.listingId);
  }
  counters.added += inserts.length;

  for (let i = 0; i < newHistory.length; i += INSERT_CHUNK) {
    await prisma.carHistory.createMany({ data: newHistory.slice(i, i + INSERT_CHUNK) });
  }

  // An unchanged car costs no SQL at all, so a re-import that finds nothing new
  // finishes without touching the database.
  if (!inserts.length && !newHistory.length && !updates.size) {
    return { statements: 0, committedIds };
  }

  let statements = 0;
  for (const { data, ids } of updates.values()) {
    // A duplicate that filled a gap can move a listing to another change-set,
    // leaving its first group empty.
    if (!ids.length) continue;
    for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
      const chunk = ids.slice(i, i + UPDATE_CHUNK);
      await prisma.car.updateMany({ where: { listingId: { in: chunk } }, data });
      counters.updated += chunk.length;
      statements++;
    }
  }
  return { statements, committedIds };
}

async function main() {
  const started = Date.now();
  await fs.mkdir(processedDir, { recursive: true });
  await fs.mkdir(unprocessedDir, { recursive: true });

  const allFiles = await fs.readdir(unprocessedDir);
  const files = allFiles
    .filter((file) => path.extname(file) === '.json')
    .sort((a, b) => (fileTimestampFromName(a)?.getTime() || 0) - (fileTimestampFromName(b)?.getTime() || 0));

  const existingCount = await prisma.car.count();
  console.log(`Total cars in the database: ${existingCount}`);
  if (!files.length) {
    console.log('Nothing to process - unprocessed/ contains no .json files.');
    return;
  }
  console.log(`Found ${files.length} file(s) to process.`);

  // Read every queued file up front so we know exactly which cars we need.
  const queued = [];
  const wantedIds = new Set();
  let totalRecords = 0;
  for (const file of files) {
    const fileTimestamp = fileTimestampFromName(file);
    if (!fileTimestamp) {
      console.warn(`Skipping ${file}: could not parse a timestamp from the filename.`);
      continue;
    }
    const cars = JSON.parse(await fs.readFile(path.join(unprocessedDir, file), 'utf-8'));
    queued.push({ file, fileTimestamp, cars });
    totalRecords += cars.length;
    for (const car of cars) if (car && car.listingId) wantedIds.add(car.listingId);
  }
  if (!queued.length) {
    console.log('No processable files (all filenames lacked a timestamp).');
    return;
  }
  console.log(`Queued ${totalRecords} records across ${queued.length} file(s), ${wantedIds.size} distinct listings.`);

  // Load ONLY the rows these files could affect, instead of the whole table.
  // Chunked to stay well inside SQLite's bound-parameter limit.
  console.log('Loading matching existing rows...');
  const tRead = Date.now();
  const existingById = new Map();
  const ids = [...wantedIds];
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const chunk = ids.slice(i, i + LOOKUP_CHUNK);
    const rows = await prisma.car.findMany({ where: { listingId: { in: chunk } } });
    for (const row of rows) existingById.set(row.listingId, row);
  }
  console.log(`  loaded ${existingById.size} existing rows in ${((Date.now() - tRead) / 1000).toFixed(1)}s`);

  const counters = { added: 0, updated: 0 };
  const totalUnchanged = { value: 0 };
  const totalSkipped = { value: 0 };
  const totalDuplicates = { value: 0 };
  const completed = [];

  for (const { file, fileTimestamp, cars } of queued) {
    console.log(`\nProcessing ${file}, found ${cars.length} records.`);

    const before = { ...counters };
    const plan = planFile(cars, fileTimestamp, existingById);
    const { statements, committedIds } = await flush(plan, counters);
    totalUnchanged.value += plan.unchanged;
    totalSkipped.value += plan.skipped;
    totalDuplicates.value += plan.inFileDuplicates;

    // Keep the in-memory view current so later (newer) files compare correctly.
    for (const row of plan.inserts) {
      if (committedIds.has(row.listingId)) existingById.set(row.listingId, row);
    }
    for (const { data, ids: groupIds } of plan.updates.values()) {
      for (const id of groupIds) {
        const prev = existingById.get(id);
        if (!prev) continue;
        existingById.set(id, { ...prev, ...data });
      }
    }

    completed.push(file);
    console.log(`Finished processing ${file}:`);
    console.log(`  - Added: ${counters.added - before.added} new cars`);
    console.log(`  - Updated: ${counters.updated - before.updated} existing cars`);
    console.log(`  - No changes: ${plan.unchanged} cars (already up to date)`);
    console.log(`  - Skipped: ${plan.skipped} cars (not newer than stored)`);
    if (plan.inFileDuplicates) {
      console.log(`  - Duplicate listings in this file: ${plan.inFileDuplicates} (merged)`);
    }
    console.log(`  - SQL statements used: ${statements}`);
  }

  // Move files across only after their rows are committed.
  for (const file of completed) {
    await fs.rename(path.join(unprocessedDir, file), path.join(processedDir, file));
  }

  const finalCount = await prisma.car.count();
  console.log(`\n--- Summary ---`);
  console.log(`Files processed : ${completed.length}`);
  console.log(`Added           : ${counters.added}`);
  console.log(`Updated         : ${counters.updated}`);
  console.log(`No changes      : ${totalUnchanged.value}`);
  console.log(`Skipped         : ${totalSkipped.value} (older than stored data)`);
  console.log(`Merged repeats  : ${totalDuplicates.value} (same listing twice in one file)`);
  console.log(`Total in DB     : ${finalCount}`);
  console.log(`Duration        : ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((error) => {
    console.error('An error occurred:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
