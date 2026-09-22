/**
 * Rebuild index.html from bootstrap.html + all-cars-from-db.json.
 *
 *   node update-index-html-with-new-cars.js
 *
 * The car data is embedded gzip-compressed + base64-encoded in a
 * <script type="application/octet-stream" id="car-data"> block and inflated in
 * the browser with DecompressionStream (see Scraper/car-data-embed.js).
 *
 * That compression is what removes the old 70,000-car cap: as raw JSON the full
 * dataset is ~117 MB (over GitHub Pages' 100 MB limit), but gzip+base64 is
 * ~21 MB, so every car in the database can ship.
 */

const fs = require('fs');
const path = require('path');
const embed = require('./Scraper/car-data-embed');

const root = __dirname;
const templatePath = path.join(root, 'bootstrap.html');
const carsPath = path.join(root, 'all-cars-from-db.json');
const outputPath = path.join(root, 'index.html');

function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function main() {
  if (!fs.existsSync(templatePath)) fail(`template not found: ${templatePath}`);
  if (!fs.existsSync(carsPath)) fail(`car export not found: ${carsPath} (run: npm run export:all)`);

  const template = fs.readFileSync(templatePath, 'utf-8');
  if (template.includes('"listingId"')) {
    fail('bootstrap.html still contains inline car data.\n' +
      '       Run: node Scraper/migrate-template.js');
  }

  console.log('reading', (fs.statSync(carsPath).size / 1048576).toFixed(1), 'MB from', path.basename(carsPath));
  const raw = fs.readFileSync(carsPath, 'utf-8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`all-cars-from-db.json is not valid JSON: ${err.message}`);
  }

  const cars = parsed.Car || (Array.isArray(parsed) ? parsed : []);
  if (!Array.isArray(cars)) fail('all-cars-from-db.json has no "Car" array');
  if (cars.length === 0) fail('all-cars-from-db.json contains 0 cars - refusing to publish an empty page');
  console.log(`cars to embed: ${cars.length}`);

  const payload = JSON.stringify({ Car: cars });
  console.log('raw payload  :', (payload.length / 1048576).toFixed(1), 'MB');

  const t0 = Date.now();
  const base64 = embed.compressStringToBase64(payload);
  console.log('gzip+base64  :', (base64.length / 1048576).toFixed(1), 'MB',
    `(${(100 - (base64.length / payload.length) * 100).toFixed(1)}% smaller, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const html = embed.setDataBlock(template, base64);

  // Guard: this must not have touched the dashboard code (see car-data-embed.js
  // for the regression this protects against).
  embed.assertEmbeddable(html, { minBytes: 20000 });
  if (embed.readDataBlock(html) !== base64) fail('data block does not match what was written');

  const totalMb = html.length / 1048576;
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`\nwrote ${outputPath}`);
  console.log(`index.html   : ${totalMb.toFixed(1)} MB (GitHub Pages limit: 100 MB)`);
  if (totalMb > 95) console.warn('WARNING: approaching the 100 MB GitHub Pages file limit.');
  console.log(`cars embedded: ${cars.length} (no cap)`);
}

main();
