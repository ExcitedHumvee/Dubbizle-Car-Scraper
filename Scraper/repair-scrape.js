/**
 * Repair a scraped JSON file so it satisfies the Prisma schema.
 *
 *   node Scraper/repair-scrape.js <file.json>          # report + fix in place
 *   node Scraper/repair-scrape.js <file.json> --dry-run
 *
 * Newer scrapes are already validated before writing, so this exists for files
 * produced by an older mapper (e.g. `motorsTrim: { id: null, name: null }`,
 * which makes save-to-db.js throw `Expected String or Null, provided Object`).
 */

const fs = require('fs');
const { toStringOrNull } = require('./algolia-mapper');

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!file) {
  console.error('usage: node Scraper/repair-scrape.js <file.json> [--dry-run]');
  process.exit(1);
}

const STRING_FIELDS = [
  'listingId', 'make', 'model', 'title', 'spec', 'bodyType', 'engineCapacity',
  'horsepower', 'transmissionType', 'interiorColor', 'exteriorColor', 'doors',
  'seatingCapacity', 'trim', 'warranty', 'fuelType', 'motorsTrim', 'sellerType',
  'location', 'neighbourhood', 'detailPageUrl', 'thumbnailUrl', 'vehicleReference',
];

const cars = JSON.parse(fs.readFileSync(file, 'utf-8'));
const repairs = new Map();
const note = (field, before) => {
  if (!repairs.has(field)) repairs.set(field, { count: 0, sample: JSON.stringify(before).slice(0, 80) });
  repairs.get(field).count++;
};

for (const car of cars) {
  for (const field of STRING_FIELDS) {
    const value = car[field];
    if (value === null || value === undefined || typeof value === 'string') continue;
    note(field, value);
    car[field] = toStringOrNull(value);
  }
  for (const field of ['badges', 'extras', 'technicalFeatures']) {
    if (!Array.isArray(car[field])) {
      note(field, car[field]);
      car[field] = car[field] === null || car[field] === undefined ? [] : [String(car[field])];
    } else if (car[field].some((x) => typeof x !== 'string')) {
      note(field, car[field]);
      car[field] = car[field].map((x) => (typeof x === 'string' ? x : toStringOrNull(x))).filter(Boolean);
    }
  }
}

console.log(`file: ${file}`);
console.log(`cars: ${cars.length}`);
if (!repairs.size) {
  console.log('no repairs needed - every field already matches the schema.');
  process.exit(0);
}
console.log('\nrepaired fields:');
for (const [field, info] of repairs) {
  console.log(`  ${field}: ${info.count} row(s)  e.g. ${info.sample}`);
}

if (dryRun) {
  console.log('\n--dry-run: file not modified.');
  process.exit(0);
}

fs.writeFileSync(file, JSON.stringify(cars));
console.log(`\nRewrote ${file} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB).`);
