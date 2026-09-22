// Full schema map of a listing hit in the current Dubizzle payload.
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const file = process.argv[2] || path.join(__dirname, 'snap-20260821194928.html');
const $ = cheerio.load(fs.readFileSync(file, 'utf-8'));
const nd = JSON.parse($('body').find('#__NEXT_DATA__').html());
const acts = nd.props.pageProps.reduxWrapperActionsGIPP;
const act = acts.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
const hits = act.payload.hits;
console.log('hits:', hits.length);

const h = hits.find(x => x.details) || hits[0];
const keys = Object.keys(h).sort();
console.log('\n=== all hit keys (' + keys.length + ') ===');
for (const k of keys) {
    const v = h[k];
    const t = Array.isArray(v) ? `array(${v.length})` : (v && typeof v === 'object' ? 'object' : typeof v);
    let sample = '';
    if (v === null || v === undefined) sample = String(v);
    else if (typeof v !== 'object') sample = String(v).slice(0, 80);
    else if (Array.isArray(v)) sample = JSON.stringify(v).slice(0, 80);
    else sample = JSON.stringify(v).slice(0, 80);
    console.log(`${k} [${t}] = ${sample}`);
}

console.log('\n=== details (specs) ===');
console.log(JSON.stringify(h.details, null, 1) || '(none)');

console.log('\n=== which hits have details ===', hits.filter(x => x.details).length, '/', hits.length);
console.log('\n=== payload key structure ===');
const pl = act.payload;
console.log('keys:', Object.keys(pl));
for (const k of Object.keys(pl)) {
    if (k === 'hits') continue;
    console.log(k, '=>', JSON.stringify(pl[k]).slice(0, 400));
}
