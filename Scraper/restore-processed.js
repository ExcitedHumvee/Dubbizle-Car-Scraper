/**
 * Seed a fresh clone's database from the archived scrape files.
 *
 *   node Scraper/restore-processed.js                  # report only (dry-run)
 *   node Scraper/restore-processed.js --apply          # move processed -> unprocessed
 *   node Scraper/restore-processed.js --apply --copy   # copy instead of move
 *   node Scraper/restore-processed.js --apply --limit 5
 *
 * A fresh clone has no database and an empty Scraper/unprocessed/, so there is
 * nothing for `npm run db:save` to import. The archived runs live in
 * Scraper/processed/. This moves them back into the import queue; each filename
 * carries its original scrape timestamp (`<ISO>-<count>.json`), so the rows come
 * back with their real `last_updated` values, exactly as if they had just been
 * scraped.
 *
 * Recommended fresh-clone sequence:
 *   npm install
 *   npx prisma migrate deploy        # create prisma/prisma/dev.db
 *   npm run db:restore -- --apply    # queue the archived scrapes
 *   npm run db:save                  # import them
 *
 * MOVE is the default because the queue files are routinely 65 MB each; copying
 * everything can require several GB. Pass --copy to keep the archive in place.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const copy = args.includes('--copy');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

const processedDir = path.join(__dirname, 'processed');
const unprocessedDir = path.join(__dirname, 'unprocessed');

/** Parse `<ISO timestamp>-<count>.json`; returns null when unparseable. */
function fileTimestampFromName(file) {
  const name = file.split('.')[0];
  const parts = name.split('T');
  if (parts.length < 2) return null;
  const timeParts = parts[1].split('-');
  if (timeParts.length < 4) return null;
  const d = new Date(`${parts[0]}T${timeParts.slice(0, 3).join(':')}.${timeParts[3]}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

function main() {
  if (!fs.existsSync(processedDir)) {
    console.error(`No archive directory at ${processedDir}`);
    process.exit(1);
  }
  fs.mkdirSync(unprocessedDir, { recursive: true });

  // Only top-level .json files; subdirectories (e.g. the old no-spec format)
  // are ignored on purpose.
  const files = fs
    .readdirSync(processedDir)
    .filter((f) => fs.statSync(path.join(processedDir, f)).isFile() && path.extname(f) === '.json');

  const dated = [];
  const undated = [];
  for (const f of files) {
    const ts = fileTimestampFromName(f);
    if (ts) dated.push({ file: f, ts });
    else undated.push(f);
  }
  dated.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const existing = new Set(fs.readdirSync(unprocessedDir));
  const selected = dated.slice(0, Number.isFinite(limit) ? limit : dated.length);
  const alreadyQueued = selected.filter((d) => existing.has(d.file));
  const toMove = selected.filter((d) => !existing.has(d.file));

  const totalBytes = toMove.reduce((a, d) => a + fs.statSync(path.join(processedDir, d.file)).size, 0);

  console.log(`processed archive : ${processedDir}`);
  console.log(`unprocessed queue : ${unprocessedDir}`);
  console.log(`\narchived runs     : ${dated.length} (${undated.length} undated, skipped)`);
  if (dated.length) {
    console.log(`date range        : ${dated[0].ts.toISOString()}  ->  ${dated[dated.length - 1].ts.toISOString()}`);
  }
  console.log(`already queued    : ${alreadyQueued.length} (skipped)`);
  console.log(`to ${copy ? 'copy' : 'move'}          : ${toMove.length} files (${mb(totalBytes)})`);
  if (undated.length) {
    console.log('\nundated filenames (not restorable - import needs a timestamp):');
    undated.slice(0, 5).forEach((f) => console.log(`  ${f}`));
    if (undated.length > 5) console.log(`  ... and ${undated.length - 5} more`);
  }

  if (!toMove.length) {
    console.log('\nNothing to restore.');
    return;
  }

  if (!apply) {
    console.log(`\nfirst 3: ${toMove.slice(0, 3).map((d) => d.file).join(', ')}`);
    console.log(`\n--dry-run: nothing changed. Re-run with --apply to ${copy ? 'copy' : 'move'}.`);
    if (!copy) console.log('(the archive is moved, not copied - pass --copy to keep it in place)');
    return;
  }

  console.log(`\n${copy ? 'copying' : 'moving'}...`);
  let done = 0;
  for (const d of toMove) {
    const src = path.join(processedDir, d.file);
    const dest = path.join(unprocessedDir, d.file);
    if (copy) fs.copyFileSync(src, dest);
    else fs.renameSync(src, dest);
    done++;
    if (done % 20 === 0) console.log(`  ... ${done} of ${toMove.length}`);
  }

  console.log(`\nrestored ${done} files (${mb(totalBytes)}) into Scraper/unprocessed/`);
  console.log('\nNext:');
  console.log('  npm run db:save      # import the queue into prisma/prisma/dev.db');
  console.log('  npm run export:all && npm run sync:index   # rebuild index.html');
}

main();
