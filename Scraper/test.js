/**
 * Offline + live tests for the Algolia-backed Dubizzle scraper.
 *
 *   node scraper/test.js             # mapper unit tests + live API smoke test
 *   node scraper/test.js --offline   # mapper unit tests only (no network)
 *
 * The mapper tests use realistic hit fixtures shaped exactly like records from
 * the `motors.com` index, so the field mapping is verified without touching the
 * network or Dubizzle's WAF.
 */

const assert = require('assert');

const { mapHit, toList, toStringOrNull, cleanSpec, parsePrice, toInt } = require('./algolia-mapper');
const config = require('./algolia-config');

const offline = process.argv.includes('--offline');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A hit exactly like the current index shape (details + details_v2). */
const modernHit = {
  id: 16970449,
  uuid: '06d8d69c130e47ada8c0a82291cf2228',
  name: { en: 'Jeep Grand Cherokee SRT8  GCC limited', ar: '...' },
  price: 39500,
  year: 2013,
  kilometers: 141000,
  seller_type: 'OW',
  added: 1790092921,
  created_at: 1788932152,
  is_premium: true,
  is_verified_user: false,
  body_type: 'SUV',
  photos_count: 18,
  photo_thumbnails: ['https://dbz-images.dubizzle.com/a.jpeg?impolicy=lpv'],
  motors_trim: { id: 502, name: 'Srt8' },
  absolute_url: { en: 'https://dubai.dubizzle.com/motors/used-cars/jeep/grand-cherokee/x---06d8d69c130e47ada8c0a82291cf2228/' },
  location_list: { en: ['UAE', 'Dubai', "Za'abeel", "Za'abeel 1"] },
  neighbourhood: { en: 'Za\'abeel 1' },
  details: {
    Make: { en: { label: 'Make', value: 'Jeep' } },
    Model: { en: { label: 'Model', value: 'Grand Cherokee' } },
    Year: { en: { label: 'Year', value: '2013' } },
    'Regional Specs': { en: { label: 'Regional Specs', value: 'GCC Specs' } },
    'Body Type': { en: { label: 'Body Type', value: 'SUV' } },
    'Engine Capacity (cc)': { en: { label: 'Engine Capacity (cc)', value: '4000+ cc' } },
    Horsepower: { en: { label: 'Horsepower', value: '500 - 599 HP' } },
    'Transmission Type': { en: { label: 'Transmission Type', value: 'Automatic Transmission' } },
    'No. of Cylinders': { en: { label: 'No. of Cylinders', value: '8' } },
    'Interior Color': { en: { label: 'Interior Color', value: 'Black' } },
    'Exterior Color': { en: { label: 'Exterior Color', value: 'White' } },
    Doors: { en: { label: 'Doors', value: '5+ doors' } },
    'Seating Capacity': { en: { label: 'Seating Capacity', value: '5 Seater' } },
    Trim: { en: { label: 'Trim', value: 'SRT8' } },
    Warranty: { en: { label: 'Warranty', value: 'No' } },
    'Fuel Type': { en: { label: 'Fuel Type', value: 'Petrol' } },
    'Vehicle Reference': { en: { label: 'Vehicle Reference', value: 'REF-123' } },
    Badges: { en: { label: 'Badges', value: 'Dealer Warranty, Service History' } },
    'Comfort & Convenience': {
      en: { label: 'Comfort & Convenience', value: 'Air Conditioning, Keyless Entry, Power Seats' },
    },
    Exterior: { en: { label: 'Exterior', value: 'Alloy Wheels, Sunroof' } },
    'Entertainment & Technology': { en: { label: 'Entertainment & Technology', value: 'Bluetooth' } },
    'Driver Assistance & Safety': {
      en: { label: 'Driver Assistance & Safety', value: 'Anti-Lock Brakes (ABS), Cruise Control, Airbags' },
    },
  },
  details_v2: {
    primary: [
      { label: { en: 'Interior Color' }, value: { en: 'Black' }, slug: 'interior_color' },
      { label: { en: 'Trim' }, value: { en: 'SRT8' }, slug: 'motors_trim' },
    ],
    secondary: [
      { label: { en: 'Body Type' }, value: { en: 'SUV' }, slug: 'body_type' },
      { label: { en: 'No. of Cylinders' }, value: { en: '8' }, slug: 'no_of_cylinders' },
    ],
  },
  category_v2: { slug_paths: ['motors', 'motors/used-cars', 'motors/used-cars/jeep'] },
  site: { en: 'Dubai' },
};

/**
 * An older-shape hit: no `details_v2` at all. Regression guard for the period
 * where only the legacy `details` map existed.
 */
const legacyHit = {
  id: 1,
  uuid: 'a'.repeat(32),
  name: { en: 'Legacy Car' },
  price: { value: { raw: 12345, negotiable: true } },
  added: 1700000000,
  created_at: 1600000000,
  is_premium: false,
  photo_thumbnails: [],
  location_list: { en: ['UAE', 'Sharjah'] },
  details: {
    Make: { en: { value: 'Toyota' } },
    Model: { en: { value: 'Corolla' } },
    Year: { en: { value: '2019' } },
    Kilometers: { en: { value: '85,000' } },
    'Regional Specs': { en: { value: 'Other Specs' } },
  },
};

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------
console.log('Mapper unit tests');

test('toList splits a site-joined string', () => {
  assert.deepStrictEqual(toList('A, B, C'), ['A', 'B', 'C']);
});

test('toList keeps commas inside parentheses', () => {
  assert.deepStrictEqual(
    toList('Anti-Lock Brakes (ABS), Child Seat Anchors (ISOFIX), Cruise Control'),
    ['Anti-Lock Brakes (ABS)', 'Child Seat Anchors (ISOFIX)', 'Cruise Control']
  );
});

test('toList handles arrays, empties and null', () => {
  assert.deepStrictEqual(toList(['A', 'B']), ['A', 'B']);
  assert.deepStrictEqual(toList(''), []);
  assert.deepStrictEqual(toList(null), []);
  assert.deepStrictEqual(toList(undefined), []);
});

test('cleanSpec strips the " Specs" suffix', () => {
  assert.strictEqual(cleanSpec('GCC Specs'), 'GCC');
  assert.strictEqual(cleanSpec('Other Specs'), 'Other');
  assert.strictEqual(cleanSpec(null), null);
});

test('parsePrice handles numbers and legacy objects', () => {
  assert.strictEqual(parsePrice(39500), 39500);
  assert.strictEqual(parsePrice({ value: { raw: 12345 } }), 12345);
  assert.strictEqual(parsePrice('18,000 AED'), 18000);
  assert.strictEqual(parsePrice(null), null);
});

test('toInt parses and rejects junk', () => {
  assert.strictEqual(toInt('141,000 km'), 141000);
  assert.strictEqual(toInt(8), 8);
  assert.strictEqual(toInt(''), null);
  assert.strictEqual(toInt('abc'), null);
});

test('toInt unwraps localised objects (regression: cylinders as object)', () => {
  assert.strictEqual(toInt({ en: '4' }), 4);
  assert.strictEqual(toInt({ value: '8' }), 8);
  assert.strictEqual(toInt({ value: { raw: 6 } }), 6);
  assert.strictEqual(toInt({}), null);
  assert.strictEqual(toInt(true), null);
});

test('mapHit always yields an integer or null for cylinders', () => {
  const asObject = JSON.parse(JSON.stringify(modernHit));
  asObject.details_v2.secondary = [{ label: { en: 'No. of Cylinders' }, value: { en: '8' }, slug: 'no_of_cylinders' }];
  delete asObject.details['No. of Cylinders'];
  const car = mapHit(asObject);
  assert.strictEqual(car.cylinders, 8);
  assert.strictEqual(typeof car.cylinders, 'number');

  const missing = JSON.parse(JSON.stringify(modernHit));
  delete missing.details['No. of Cylinders'];
  delete missing.details_v2.secondary;
  assert.strictEqual(mapHit(missing).cylinders, null);
});

test('toStringOrNull coerces object-shaped spec values', () => {
  assert.strictEqual(toStringOrNull('SRT8'), 'SRT8');
  assert.strictEqual(toStringOrNull(8), '8');
  assert.strictEqual(toStringOrNull({ en: 'SRT8' }), 'SRT8');
  assert.strictEqual(toStringOrNull({ name: 'SRT8' }), 'SRT8');
  assert.strictEqual(toStringOrNull({ value: { en: 'SRT8' } }), 'SRT8');
  // regression: this shape used to be passed straight to prisma and blew up
  // with "Argument `motorsTrim`: Invalid value provided. Expected String or Null"
  assert.strictEqual(toStringOrNull({ id: null, name: null }), null);
  assert.strictEqual(toStringOrNull({}), null);
  assert.strictEqual(toStringOrNull([]), null);
  assert.strictEqual(toStringOrNull(null), null);
  assert.strictEqual(toStringOrNull('   '), null);
});

test('mapHit never emits an object for any String column (prisma safety)', () => {
  // Build a hit where several spec values are object-shaped or empty objects.
  const messy = JSON.parse(JSON.stringify(modernHit));
  messy.motors_trim = { id: null, name: null };
  messy.body_type = { id: 3, name: 'SUV' };
  messy.name = { en: 'Tidy Name' };
  // only source of Trim is an object that carries no usable text
  delete messy.details['Trim'];
  messy.details_v2.primary = [{ label: { en: 'Trim' }, value: { id: 1, name: null }, slug: 'motors_trim' }];
  const car = mapHit(messy);

  const stringFields = [
    'listingId', 'make', 'model', 'title', 'spec', 'bodyType', 'engineCapacity',
    'horsepower', 'transmissionType', 'interiorColor', 'exteriorColor', 'doors',
    'seatingCapacity', 'trim', 'warranty', 'fuelType', 'motorsTrim', 'sellerType',
    'location', 'neighbourhood', 'detailPageUrl', 'thumbnailUrl', 'vehicleReference',
  ];
  for (const field of stringFields) {
    const value = car[field];
    assert.ok(
      value === null || typeof value === 'string',
      `${field} must be string|null, got ${typeof value} (${JSON.stringify(value)})`
    );
  }
  // object-shaped values with no usable text degrade to null, never "[object Object]"
  assert.strictEqual(car.trim, null);
  assert.strictEqual(car.motorsTrim, null);
  // object-shaped values that DO carry text are unwrapped
  assert.strictEqual(car.bodyType, 'SUV');
  assert.strictEqual(car.title, 'Tidy Name');
});

test('repair-scrape.js logic is idempotent on clean data', () => {
  // mirrors what repair-scrape.js does to a String column
  const car = mapHit(modernHit);
  for (const field of ['make', 'model', 'trim', 'motorsTrim']) {
    assert.strictEqual(toStringOrNull(car[field]), car[field]);
  }
});

test('mapHit maps a current hit completely', () => {
  const car = mapHit(modernHit);
  assert.strictEqual(car.listingId, modernHit.uuid);
  assert.strictEqual(car.make, 'Jeep');
  assert.strictEqual(car.model, 'Grand Cherokee');
  assert.strictEqual(car.year, 2013);
  assert.strictEqual(car.mileage, 141000);
  assert.strictEqual(car.price, 39500);
  assert.strictEqual(car.title, 'Jeep Grand Cherokee SRT8  GCC limited');
  assert.strictEqual(car.spec, 'GCC');
  assert.strictEqual(car.isPremium, true);
  assert.strictEqual(car.bodyType, 'SUV');
  assert.strictEqual(car.engineCapacity, '4000+ cc');
  assert.strictEqual(car.horsepower, '500 - 599 HP');
  assert.strictEqual(car.transmissionType, 'Automatic Transmission');
  assert.strictEqual(car.cylinders, 8);
  assert.strictEqual(car.interiorColor, 'Black');
  assert.strictEqual(car.exteriorColor, 'White');
  assert.strictEqual(car.doors, '5+ doors');
  assert.strictEqual(car.seatingCapacity, '5 Seater');
  assert.strictEqual(car.trim, 'SRT8');
  assert.strictEqual(car.warranty, 'No');
  assert.strictEqual(car.fuelType, 'Petrol');
  assert.strictEqual(car.motorsTrim, 'Srt8');
  assert.strictEqual(car.sellerType, 'Owner');
  assert.strictEqual(car.location, "Za'abeel 1, Za'abeel");
  assert.strictEqual(car.neighbourhood, "Za'abeel 1");
  assert.strictEqual(car.detailPageUrl, modernHit.absolute_url.en);
  assert.strictEqual(car.thumbnailUrl, modernHit.photo_thumbnails[0]);
  assert.strictEqual(car.vehicleReference, 'REF-123');
  assert.strictEqual(car.isVerifiedUser, false);
  assert.strictEqual(car.isNegotiable, false);
  assert.strictEqual(car.createdAt, new Date(1788932152 * 1000).toISOString());
  assert.strictEqual(car.added, new Date(1790092921 * 1000).toISOString());
});

test('mapHit splits badges and feature lists like the old scraper', () => {
  const car = mapHit(modernHit);
  assert.deepStrictEqual(car.badges, ['Dealer Warranty', 'Service History']);
  assert.deepStrictEqual(car.extras, [
    'Air Conditioning', 'Keyless Entry', 'Power Seats', 'Alloy Wheels', 'Sunroof', 'Bluetooth',
  ]);
  assert.deepStrictEqual(car.technicalFeatures, [
    'Anti-Lock Brakes (ABS)', 'Cruise Control', 'Airbags',
  ]);
});

test('mapHit never emits undefined for schema fields', () => {
  const car = mapHit(modernHit);
  const required = [
    'listingId', 'make', 'model', 'year', 'mileage', 'price', 'title', 'spec', 'isPremium',
    'bodyType', 'engineCapacity', 'horsepower', 'transmissionType', 'cylinders', 'interiorColor',
    'exteriorColor', 'doors', 'seatingCapacity', 'trim', 'warranty', 'fuelType', 'motorsTrim',
    'sellerType', 'location', 'neighbourhood', 'detailPageUrl', 'isNegotiable', 'thumbnailUrl',
    'vehicleReference', 'isVerifiedUser', 'createdAt', 'added', 'badges', 'extras', 'technicalFeatures',
  ];
  for (const key of required) {
    assert.ok(key in car, `missing key ${key}`);
    assert.notStrictEqual(car[key], undefined, `undefined value for ${key}`);
  }
  // `cylinders` must be an Int for prisma
  assert.ok(Number.isInteger(car.cylinders) || car.cylinders === null);
});

test('mapHit still works for legacy hits with no details_v2', () => {
  const car = mapHit(legacyHit);
  assert.strictEqual(car.make, 'Toyota');
  assert.strictEqual(car.model, 'Corolla');
  assert.strictEqual(car.year, 2019);
  assert.strictEqual(car.mileage, 85000);
  assert.strictEqual(car.price, 12345);
  assert.strictEqual(car.spec, 'Other');
  assert.strictEqual(car.isPremium, false);
  assert.deepStrictEqual(car.badges, []);
  assert.deepStrictEqual(car.extras, []);
});

test('mapHit returns null for a hit without uuid', () => {
  assert.strictEqual(mapHit({ id: 5 }), null);
  assert.strictEqual(mapHit(null), null);
});

test('config exposes sane defaults', () => {
  assert.match(config.FILTER, /motors\/used-cars/);
  assert.ok(config.HITS_PER_PAGE > 0 && config.HITS_PER_PAGE <= 1000, 'hitsPerPage must be <= 1000');
  assert.ok(config.APP_ID && config.API_KEY, 'credentials must be configured');
});

// ---------------------------------------------------------------------------
// Live API smoke test
// ---------------------------------------------------------------------------
async function liveTest() {
  console.log('\nLive Algolia API test');
  const https = require('https');
  const zlib = require('zlib');

  const credFile = require('path').join(__dirname, 'algolia-credentials.json');
  let { APP_ID, API_KEY, INDEX, FILTER } = config;
  if (require('fs').existsSync(credFile)) {
    const c = JSON.parse(require('fs').readFileSync(credFile, 'utf-8'));
    APP_ID = c.appId || c.algolia_app_id || APP_ID;
    API_KEY = c.apiKey || c.algolia_app_key || API_KEY;
    INDEX = c.index || c.algoliaIndexName || INDEX;
  }

  const body = JSON.stringify({ params: `query=&hitsPerPage=3&filters=${encodeURIComponent(FILTER)}` });
  const res = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${APP_ID}-dsn.algolia.net`,
      path: `/1/indexes/${INDEX}/query`,
      method: 'POST',
      headers: {
        'x-algolia-application-id': APP_ID,
        'x-algolia-api-key': API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'accept-encoding': 'gzip',
      },
      timeout: 30000,
    }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        let buf = Buffer.concat(chunks);
        try { if ((r.headers['content-encoding'] || '') === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) {}
        resolve({ status: r.statusCode, body: buf.toString('utf-8') });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  assert.strictEqual(res.status, 200, `Algolia returned ${res.status}: ${res.body.slice(0, 200)}`);
  const json = JSON.parse(res.body);
  assert.ok(json.nbHits > 10000, `expected >10k used cars, got ${json.nbHits}`);
  assert.strictEqual(json.hits.length, 3);

  const car = mapHit(json.hits[0]);
  assert.ok(car && car.listingId, 'first live hit must map to a car');
  assert.ok(car.price !== null, 'live hit must have a price');
  assert.ok(car.year !== null, 'live hit must have a year');
  assert.ok(car.make, 'live hit must have a make');

  console.log(`  PASS  live query returned ${json.nbHits} used cars; mapped "${car.make} ${car.model}" (${car.year}, AED ${car.price})`);

  // pagination ceiling behaviour
  const deep = JSON.stringify({ params: `query=&hitsPerPage=1000&page=10&filters=${encodeURIComponent(FILTER)}` });
  const deepRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${APP_ID}-dsn.algolia.net`,
      path: `/1/indexes/${INDEX}/query`,
      method: 'POST',
      headers: {
        'x-algolia-application-id': APP_ID,
        'x-algolia-api-key': API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(deep),
        'accept-encoding': 'gzip',
      },
      timeout: 30000,
    }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        let buf = Buffer.concat(chunks);
        try { if ((r.headers['content-encoding'] || '') === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) {}
        resolve(buf.toString('utf-8'));
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(deep);
    req.end();
  });
  const deepJson = JSON.parse(deepRes);
  assert.ok(deepJson.message && /10000 hits/.test(deepJson.message), 'expected the 10k pagination cap');
  console.log('  PASS  pagination cap confirmed (10k/query) - partitioning strategy still required');
}

(async () => {
  if (!offline) {
    try {
      await liveTest();
      passed++;
    } catch (err) {
      failed++;
      console.error(`  FAIL  live Algolia API test\n        ${err.message}`);
    }
  } else {
    console.log('\n(skipping live API test: --offline)');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
