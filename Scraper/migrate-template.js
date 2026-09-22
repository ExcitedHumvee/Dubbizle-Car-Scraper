/**
 * One-off migration: convert bootstrap.html from inline raw JSON to the
 * compressed data-block format.
 *
 *   node Scraper/migrate-template.js [--dry-run]
 *
 * Replaces the giant `const jsonData = {...}` assignment with:
 *   - a `const jsonData = { Car: [] }` placeholder
 *   - an `async function loadCarData()` that inflates the data block
 *   - an async IIFE wrapping the data-dependent initialisation below it
 *
 * and appends an empty <script id="car-data"> block. bootstrap.html then stays a
 * small, editable template; the real dataset is written into index.html by
 * update-index-html-with-new-cars.js.
 *
 * Safe to re-run: it detects an already-migrated template and exits.
 */

const fs = require('fs');
const path = require('path');
const embed = require('./car-data-embed');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'bootstrap.html');
const dryRun = process.argv.includes('--dry-run');

const before = fs.readFileSync(templatePath, 'utf-8');
console.log('template      :', templatePath);
console.log('size before   :', (before.length / 1024).toFixed(0), 'KB');

if (before.includes('async function loadCarData')) {
  console.log('already migrated - nothing to do.');
  process.exit(0);
}

const hadInlineData = embed.findJsonDataAssignment(before) !== null;
if (!hadInlineData) {
  console.error('could not find `const jsonData = {...}` - is this the right template?');
  process.exit(1);
}

let { html, removedBytes, neutralisedAssignments } = embed.replaceJsonDataAssignment(before);
console.log('removed inline jsonData:', (removedBytes / 1024).toFixed(0), 'KB');
console.log('neutralised tableData assignments:', neutralisedAssignments);

html = embed.setDataBlock(html, embed.compressToBase64({ Car: [] }));
console.log('size after    :', (html.length / 1024).toFixed(0), 'KB');

// Validate BEFORE writing anything - the previous attempt silently truncated
// the page, so this must fail loudly instead.
embed.assertEmbeddable(html, { minBytes: 20000 });
if (embed.jsonDataHasData(html)) {
  console.error('VALIDATION FAILED: inline car data still present after migration');
  process.exit(1);
}
console.log('validation    : OK');

if (dryRun) {
  console.log('--dry-run: not written.');
  process.exit(0);
}

// keep a one-time backup the first time we migrate
const backupPath = path.join(root, 'Scraper', 'legacy', 'bootstrap-inline-json.html');
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, before, 'utf-8');
  console.log('backup        :', backupPath);
}

fs.writeFileSync(templatePath, html, 'utf-8');
console.log('wrote', templatePath);
