/**
 * Dubizzle used-car scraper - Algolia edition.
 *
 * Replaces the browser/HTML scraper, which is now defeated by Imperva/Incapsula:
 * uae.dubizzle.com answers automated requests with "Pardon Our Interruption" +
 * hCaptcha, and even when a page does load, the old `#__NEXT_DATA__` redux path
 * it parsed no longer holds the listings.
 *
 * This version queries the same Algolia index the website itself uses
 * (`motors.com`), using the public search key that ships inside the page
 * payload. No browser, no captcha, no WAF - and it returns *more* fields than
 * the page DOM exposed (price, mileage, year and full specs as structured data).
 *
 * Usage:
 *   node scraper/scraper.js                      # full run (all UAE used cars)
 *   node scraper/scraper.js --limit 200          # quick smoke test
 *   node scraper/scraper.js --out ../tmp.json    # custom output path
 *   node scraper/scraper.js --dry-run            # count only, write nothing
 *   node scraper/scraper.js --credentials <file> # use a different key file
 *
 * Output: Scraper/unprocessed/<timestamp>-<count>.json (consumed by save-to-db.js)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const config = require('./algolia-config');
const { mapHit } = require('./algolia-mapper');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { limit: null, out: null, dryRun: false, credentials: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--credentials') args.credentials = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (/^\d+$/.test(a)) args.limit = parseInt(a, 10);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Dubizzle Algolia scraper

  --limit N         stop after N cars (smoke testing)
  --out FILE        write the JSON to FILE instead of Scraper/unprocessed/
  --credentials F   load {appId, apiKey, index} from F (JSON)
  --dry-run         fetch and validate but write no file
  --quiet           only log warnings/errors and the final summary`);
  process.exit(0);
}

const log = (...m) => { if (!args.quiet) console.log(...m); };
const warn = (...m) => console.warn(...m);

let credentials = { appId: config.APP_ID, apiKey: config.API_KEY, index: config.INDEX };
if (args.credentials) {
  const file = path.resolve(args.credentials);
  if (!fs.existsSync(file)) {
    console.error(`Credentials file not found: ${file}`);
    process.exit(1);
  }
  const loaded = JSON.parse(fs.readFileSync(file, 'utf-8'));
  credentials = {
    appId: loaded.appId || loaded.algolia_app_id || credentials.appId,
    apiKey: loaded.apiKey || loaded.algolia_app_key || credentials.apiKey,
    index: loaded.index || loaded.algoliaIndexName || credentials.index,
  };
  log(`Using credentials from ${file}`);
}

// Allow a checked-in override so a rotated key needs no code edit.
const credFile = path.join(__dirname, 'algolia-credentials.json');
if (!args.credentials && fs.existsSync(credFile)) {
  const loaded = JSON.parse(fs.readFileSync(credFile, 'utf-8'));
  credentials = {
    appId: loaded.appId || loaded.algolia_app_id || credentials.appId,
    apiKey: loaded.apiKey || loaded.algolia_app_key || credentials.apiKey,
    index: loaded.index || loaded.algoliaIndexName || credentials.index,
  };
  log(`Using credentials from ${credFile}`);
}

const HOSTS = [
  `${credentials.appId}-dsn.algolia.net`,
  `${credentials.appId}.algolia.net`,
  `${credentials.appId}-1.algolianet.com`,
  'algolia.dubizzle.com',
];

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const agent = new https.Agent({ keepAlive: true, maxSockets: Math.max(4, config.CONCURRENCY) });
let activeHost = HOSTS[0];

function rawPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname,
      path: urlPath,
      method: 'POST',
      agent,
      headers: {
        'x-algolia-application-id': credentials.appId,
        'x-algolia-api-key': credentials.apiKey,
        'content-type': 'application/json',
        'content-length': payload.length,
        'accept-encoding': 'gzip',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      timeout: 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc === 'gzip') buf = zlib.gunzipSync(buf);
          else if (enc === 'deflate') buf = zlib.inflateSync(buf);
        } catch (e) { /* leave as-is */ }
        resolve({ status: res.statusCode, body: buf.toString('utf-8') });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('request timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs one Algolia query with retries and host failover.
 * @returns {Promise<object>} the parsed Algolia response
 */
async function algoliaQuery(params) {
  let lastErr;
  let consecutiveFailures = 0;
  for (let attempt = 0; attempt < config.RETRIES; attempt++) {
    const hostsToTry = [activeHost, ...HOSTS.filter((h) => h !== activeHost)];
    for (const host of hostsToTry) {
      try {
        const res = await rawPost(host, `/1/indexes/${credentials.index}/query`, { params });
        if (res.status === 200) {
          // Only migrate to another host after repeated failures on the current
          // one, so a single blip doesn't thrash the connection.
          if (host !== activeHost) {
            consecutiveFailures++;
            if (consecutiveFailures >= 3) {
              log(`Switched Algolia host to ${host}`);
              activeHost = host;
              consecutiveFailures = 0;
            }
          } else {
            consecutiveFailures = 0;
          }
          return JSON.parse(res.body);
        }
        // 429 / 5xx are retryable; 4xx usually means bad params or a dead key.
        const retryable = res.status === 429 || res.status >= 500;
        lastErr = new Error(`HTTP ${res.status}: ${res.body.slice(0, 300)}`);
        if (!retryable) {
          if (res.status === 403 || res.status === 401) {
            throw new Error(
              `Algolia rejected the credentials (${res.status}).\n` +
              `  ${res.body.slice(0, 200)}\n` +
              '  The public search key has probably rotated. See README -> "If the key rotates".'
            );
          }
          // try next host, then retry
        }
      } catch (err) {
        if (err.message && err.message.startsWith('Algolia rejected')) throw err;
        lastErr = err;
      }
    }
    consecutiveFailures++;
    if (attempt < config.RETRIES - 1) {
      const delay = config.RETRY_DELAY_MS * Math.pow(2, attempt);
      warn(`Algolia query failed (attempt ${attempt + 1}/${config.RETRIES}), retrying in ${delay}ms: ${lastErr && lastErr.message}`);
      await sleep(delay);
    }
  }
  throw lastErr || new Error('Algolia query failed');
}

const enc = encodeURIComponent;

async function countFor(filter) {
  const res = await algoliaQuery(`query=&hitsPerPage=0&filters=${enc(filter)}`);
  return res.nbHits || 0;
}

/**
 * Work out how to slice the category so no single query needs more than the
 * 10,000-hit Algolia hard cap.
 */
async function buildPartitions(baseFilter) {
  const total = await countFor(baseFilter);
  if (total <= 10000) return [{ filter: baseFilter, expected: total }];

  log(`Category has ${total} listings, above the 10,000/query cap - partitioning by make...`);
  const facetRes = await algoliaQuery(
    `query=&hitsPerPage=0&facets=${enc(config.PARTITION_FACET)}&maxValuesPerFacet=1000&filters=${enc(baseFilter)}`
  );
  const facet = (facetRes.facets && facetRes.facets[config.PARTITION_FACET]) || {};

  // Only the direct children of the category (e.g. motors/used-cars/toyota).
  const prefixes = baseFilter.match(/"([^"]+)"/);
  const category = prefixes ? prefixes[1] : null;
  const childRe = category ? new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+$`) : null;

  const partitions = Object.entries(facet)
    .filter(([slug, count]) => count > 0 && (!childRe || childRe.test(slug)))
    .map(([slug]) => ({ slug, expected: facet[slug] }));

  log(`Found ${partitions.length} make partitions.`);

  // Any child that is itself over the cap gets split by year.
  const finalPartitions = [];
  for (const p of partitions) {
    const filter = `${baseFilter} AND ${config.PARTITION_FACET}:"${p.slug}"`;
    if (p.expected <= 10000) {
      finalPartitions.push({ filter, expected: p.expected, label: p.slug });
      continue;
    }
    log(`  ${p.slug} has ${p.expected} hits - splitting by year...`);
    const years = await algoliaQuery(
      `query=&hitsPerPage=0&facets=${enc('details.Year.en.value')}&maxValuesPerFacet=100&filters=${enc(filter)}`
    );
    const yearFacet = (years.facets && years.facets['details.Year.en.value']) || {};
    let covered = 0;
    for (const [year, count] of Object.entries(yearFacet)) {
      finalPartitions.push({
        filter: `${filter} AND ${'details.Year.en.value'}:"${year}"`,
        expected: count,
        label: `${p.slug}/${year}`,
      });
      covered += count;
    }
    if (!Object.keys(yearFacet).length) {
      warn(`  could not split ${p.slug} by year; using capped pagination`);
      finalPartitions.push({ filter, expected: Math.min(p.expected, 10000), label: p.slug, capped: true });
    } else if (covered < p.expected) {
      warn(`  ${p.slug}: year facet covers ${covered}/${p.expected} (${p.expected - covered} listings without a year will be missed)`);
    }
  }

  // Listings in the category that carry no make partition at all.
  const withMake = finalPartitions.reduce((a, p) => a + p.expected, 0);
  if (withMake < total) {
    const children = await algoliaQuery(
      `query=&hitsPerPage=0&facets=${enc(config.PARTITION_FACET)}&maxValuesPerFacet=1000&filters=${enc(baseFilter)}`
    );
    const facet2 = (children.facets && children.facets[config.PARTITION_FACET]) || {};
    const childSlugs = Object.keys(facet2).filter((s) => childRe && childRe.test(s));
    // Algolia's filter grammar has no parentheses, so exclude each make
    // individually: NOT a AND NOT b AND ...
    const notClause = childSlugs.map((s) => `NOT ${config.PARTITION_FACET}:"${s}"`).join(' AND ');
    if (notClause) {
      const restFilter = `${baseFilter} AND ${notClause}`;
      const restCount = await countFor(restFilter);
      if (restCount > 0) {
        finalPartitions.push({ filter: restFilter, expected: restCount, label: '(no make)', capped: restCount > 10000 });
      }
    }
  }

  return finalPartitions;
}

/** Fetch every hit of one partition (<= 10k by construction). */
async function fetchPartition(partition, onHit, shouldStop, onProgress) {
  let page = 0;
  let fetched = 0;
  let nbPages = 1;
  do {
    if (shouldStop && shouldStop()) break;
    if (onProgress) onProgress();
    const params = `query=&hitsPerPage=${config.HITS_PER_PAGE}&page=${page}&filters=${enc(partition.filter)}`;
    const res = await algoliaQuery(params);

    if (res.message && /can only fetch the 10000 hits/i.test(res.message)) {
      warn(`Hit the 10,000-hit cap on ${partition.label} at page ${page}; partition was larger than expected.`);
      break;
    }

    const hits = res.hits || [];
    nbPages = res.nbPages || 1;
    for (const hit of hits) {
      if (shouldStop && shouldStop()) break;
      onHit(hit);
    }
    fetched += hits.length;
    page++;

    if (!hits.length) break;
    if (page >= config.MAX_PAGES_PER_PARTITION) {
      warn(`Stopped ${partition.label} at MAX_PAGES_PER_PARTITION=${config.MAX_PAGES_PER_PARTITION}`);
      break;
    }
  } while (page < nbPages);

  return fetched;
}

/** Simple bounded-concurrency runner. */
async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------------------
// Validation - keeps a broken run out of the database
// ---------------------------------------------------------------------------

/**
 * The Prisma column types for the fields we emit. `save-to-db.js` copies these
 * straight into `prisma.car.create()`, so a wrong runtime type here is a hard
 * failure halfway through the import (after thousands of rows have been
 * written). We therefore refuse to write a file that would fail there.
 */
const SCHEMA_TYPES = {
  listingId: 'string',
  make: 'string', model: 'string', title: 'string', spec: 'string',
  bodyType: 'string', engineCapacity: 'string', horsepower: 'string',
  transmissionType: 'string', interiorColor: 'string', exteriorColor: 'string',
  doors: 'string', seatingCapacity: 'string', trim: 'string', warranty: 'string',
  fuelType: 'string', motorsTrim: 'string', sellerType: 'string',
  location: 'string', neighbourhood: 'string', detailPageUrl: 'string',
  thumbnailUrl: 'string', vehicleReference: 'string',
  year: 'int', mileage: 'int', price: 'int', cylinders: 'int',
  isPremium: 'bool', isNegotiable: 'bool', isVerifiedUser: 'bool',
  createdAt: 'string', added: 'string',
};

function typeProblems(cars) {
  const problems = new Map();
  const add = (field, got, sample) => {
    if (!problems.has(field)) problems.set(field, { count: 0, got, sample });
    problems.get(field).count++;
  };

  for (const car of cars) {
    for (const [field, want] of Object.entries(SCHEMA_TYPES)) {
      const value = car[field];
      if (value === null || value === undefined) continue; // nullable columns
      const got = Array.isArray(value) ? 'array' : typeof value;
      let ok;
      if (want === 'string') ok = got === 'string';
      else if (want === 'int') ok = got === 'number' && Number.isInteger(value);
      else if (want === 'bool') ok = got === 'boolean';
      else ok = true;
      if (!ok) add(field, got, JSON.stringify(value).slice(0, 80));
    }
    for (const field of ['badges', 'extras', 'technicalFeatures']) {
      const value = car[field];
      if (!Array.isArray(value)) add(field, Array.isArray(value) ? 'array' : typeof value, String(value).slice(0, 80));
      else if (value.some((x) => typeof x !== 'string')) add(field, 'array<non-string>', JSON.stringify(value).slice(0, 80));
    }
  }
  return problems;
}

function summarise(cars) {
  const total = cars.length;
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
  const has = (fn) => cars.filter(fn).length;
  const stats = {
    cars: total,
    price: has((c) => c.price !== null),
    mileage: has((c) => c.mileage !== null),
    year: has((c) => c.year !== null),
    make: has((c) => c.make),
    model: has((c) => c.model),
    spec: has((c) => c.spec),
    bodyType: has((c) => c.bodyType),
    fuelType: has((c) => c.fuelType),
    transmissionType: has((c) => c.transmissionType),
    detailPageUrl: has((c) => c.detailPageUrl),
    thumbnailUrl: has((c) => c.thumbnailUrl),
    added: has((c) => c.added),
    extrasList: has((c) => Array.isArray(c.extras) && c.extras.length > 1),
    techFeaturesList: has((c) => Array.isArray(c.technicalFeatures) && c.technicalFeatures.length > 1),
  };
  stats.percentages = Object.fromEntries(
    Object.entries(stats).filter(([k]) => k !== 'cars').map(([k, v]) => [k, pct(v)])
  );
  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const started = Date.now();
  log('--- Dubizzle scraper (Algolia direct) ---');
  log(`Index: ${credentials.index}  App: ${credentials.appId}`);
  log(`Filter: ${config.FILTER}`);

  const partitions = await buildPartitions(config.FILTER);
  const expected = partitions.reduce((a, p) => a + p.expected, 0);
  log(`Planned ${partitions.length} partition(s), ~${expected} listings.`);

  const seen = new Set();
  const cars = [];
  let processedHits = 0;
  let unmapped = 0;
  let partitionErrors = 0;
  const failedPartitions = [];

  const budget = args.limit || Infinity;
  const shouldStop = () => cars.length >= budget;

  // Fetch bigger partitions first so a --limit run reaches the budget fast.
  const ordered = [...partitions].sort((a, b) => (b.expected || 0) - (a.expected || 0));

  await mapConcurrent(ordered, config.CONCURRENCY, async (partition) => {
    if (shouldStop()) return;
    // A partition that was cut short by --limit is not a failure, so only count
    // an error if this worker had actually begun fetching.
    let started = false;
    try {
      const fetched = await fetchPartition(partition, (hit) => {
        started = true;
        processedHits++;
        const car = mapHit(hit);
        if (!car) { unmapped++; return; }
        if (seen.has(car.listingId)) return;
        seen.add(car.listingId);
        cars.push(car);
      }, shouldStop, () => { started = true; });
      log(`  ${partition.label}: ${fetched} hits (total unique: ${cars.length})`);
    } catch (err) {
      if (started && !shouldStop()) {
        partitionErrors++;
        failedPartitions.push(partition.label);
        warn(`  ${partition.label}: FAILED - ${err.message}`);
      }
    }
  });

  const stats = summarise(cars);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log('\n--- Scrape summary ---');
  console.log(`Partitions:        ${partitions.length} (${partitionErrors} failed)`);
  console.log(`Hits processed:    ${processedHits}`);
  console.log(`Unique cars:       ${cars.length}`);
  console.log(`Unmappable hits:   ${unmapped}`);
  console.log(`Duration:          ${seconds}s`);
  console.log('Field coverage:');
  for (const [k, v] of Object.entries(stats.percentages)) {
    console.log(`  ${k.padEnd(16)} ${String(stats[k]).padStart(6)}  (${v})`);
  }

  if (partitionErrors > 0) {
    console.error(`\nERROR: ${partitionErrors} partition(s) failed; refusing to write a partial file.`);
    failedPartitions.slice(0, 20).forEach((p) => console.error(`  - ${p}`));
    if (failedPartitions.length > 20) console.error(`  ... and ${failedPartitions.length - 20} more`);
    console.error('Re-run the scraper (it is idempotent) or raise SCRAPE_RETRIES.');
    process.exit(2);
  }

  if (cars.length < config.MIN_EXPECTED_CARS && !args.limit) {
    console.error(`\nERROR: only ${cars.length} cars found (minimum ${config.MIN_EXPECTED_CARS}).`);
    console.error('This usually means the Algolia key/params changed. Nothing was written.');
    process.exit(3);
  }

  if (cars.length === 0) {
    console.error('\nERROR: no cars scraped. Nothing written.');
    process.exit(3);
  }

  // A wrong runtime type would blow up save-to-db.js thousands of rows in, so
  // catch it here while nothing has been written yet.
  const problems = typeProblems(cars);
  if (problems.size > 0) {
    console.error('\nERROR: output would not satisfy the Prisma schema; refusing to write.');
    for (const [field, info] of problems) {
      console.error(`  ${field}: ${info.count} row(s) got ${info.got} (e.g. ${info.sample})`);
    }
    console.error('This is a mapper bug - please report the fields above.');
    process.exit(4);
  }

  if (args.dryRun) {
    log('\n--dry-run: no file written.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  let outPath = args.out
    ? path.resolve(args.out)
    : path.join(__dirname, 'unprocessed', `${timestamp}-${cars.length}.json`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(cars));
  console.log(`\nWrote ${cars.length} cars to ${outPath}`);
  console.log('Next: npm run db:save');
}

main().catch((err) => {
  console.error('\nFATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
