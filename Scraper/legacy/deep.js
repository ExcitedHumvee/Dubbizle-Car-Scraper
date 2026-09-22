// Deep-dive the listings redux action in the snapshot.
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const file = process.argv[2] || path.join(__dirname, 'snap-20260821194928.html');
const $ = cheerio.load(fs.readFileSync(file, 'utf-8'));
const nd = JSON.parse($('body').find('#__NEXT_DATA__').html());
const acts = nd.props.pageProps.reduxWrapperActionsGIPP;

console.log('=== action types ===');
acts.forEach((a, i) => {
    const size = JSON.stringify(a).length;
    console.log(i, a.type, `(${size} bytes)`);
});

const listingAct = acts.find(a => /listing/i.test(a.type) && /fulfilled/i.test(a.type));
if (!listingAct) { console.log('no listing fulfilled action found'); process.exit(0); }

const pl = listingAct.payload;
console.log('\n=== payload keys ===', Object.keys(pl));
const hits = pl.hits || pl.listings || [];
console.log('hits:', hits.length);
console.log('\n=== first hit keys ===');
console.log(Object.keys(hits[0]).join('\n'));
console.log('\n=== first hit sample ===');
const h = hits[0];
const slim = {};
for (const k of Object.keys(h)) {
    const v = h[k];
    let t = Array.isArray(v) ? `array(${v.length})` : (v && typeof v === 'object' ? 'object' : typeof v);
    slim[k] = t;
}
console.log(JSON.stringify(slim, null, 1));
console.log('\n=== details keys of hit[0] ===');
if (h.details) console.log(Object.keys(h.details).join('\n'));
console.log('\n=== details sample values ===');
if (h.details) {
    for (const k of ['Make', 'Model', 'Year', 'Regional Specs', 'Body Type', 'Engine Capacity (cc)', 'Transmission Type', 'Fuel Type', 'Seller type', 'No. of Cylinders', 'Trim', 'Warranty', 'Horsepower']) {
        if (h.details[k]) console.log(k, '=>', JSON.stringify(h.details[k]));
    }
}
console.log('\n=== price / mileage / timestamps of hit[0] ===');
console.log(JSON.stringify({
    price: h.price, added: h.added, created_at: h.created_at, is_premium: h.is_premium,
    is_verified_user: h.is_verified_user, neighbourhood: h.neighbourhood, uuid: h.uuid, name: h.name,
}, null, 1));
console.log('\n=== full first hit (raw, truncated) ===');
console.log(JSON.stringify(h, null, 1).slice(0, 6000));
