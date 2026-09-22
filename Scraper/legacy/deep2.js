// Find where listing data actually lives now.
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const file = process.argv[2] || path.join(__dirname, 'snap-20260821194928.html');
const $ = cheerio.load(fs.readFileSync(file, 'utf-8'));
const nd = JSON.parse($('body').find('#__NEXT_DATA__').html());
const pp = nd.props.pageProps;

console.log('=== pageProps.props ===');
console.log(JSON.stringify(pp.props, null, 1).slice(0, 2000));

const act = pp.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
console.log('\n=== fulfilled payload (truncated 3000) ===');
console.log(JSON.stringify(act.payload, null, 1).slice(0, 3000));

console.log('\n=== search whole NEXT_DATA for keys named hits/listings ===');
const seen = new Set();
function walk(o, p) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
        if (/^(hits|listings|results|items|data)$/i.test(k)) {
            const v = o[k];
            const t = Array.isArray(v) ? `array(${v.length})` : typeof v;
            console.log(`${p}.${k} => ${t}`);
        }
        walk(o[k], `${p}.${k}`);
    }
}
walk(nd, '');

console.log('\n=== card markup sample ===');
const cards = $('a[data-testid^="listing-"]');
console.log('cards:', cards.length);
console.log(cards.first().html().slice(0, 2500));
console.log('\n=== card hrefs ===');
cards.slice(0, 3).each((i, el) => console.log($(el).attr('href')));
