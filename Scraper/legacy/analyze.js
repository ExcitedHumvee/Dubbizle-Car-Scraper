// Analyse __NEXT_DATA__ structure of a saved Dubizzle listing page snapshot.
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const file = process.argv[2] || path.join(__dirname, 'snap-20260821194928.html');
const html = fs.readFileSync(file, 'utf-8');
const $ = cheerio.load(html);

const raw = $('body').find('#__NEXT_DATA__').html();
console.log('NEXT_DATA length:', raw ? raw.length : 'MISSING');
const nd = JSON.parse(raw);

console.log('top keys:', Object.keys(nd));
console.log('props keys:', Object.keys(nd.props || {}));
const pp = nd.props.pageProps || {};
console.log('pageProps keys:', Object.keys(pp));

function walk(obj, prefix, depth, out) {
    if (depth > 3 || !obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        const t = Array.isArray(v) ? `array(${v.length})` : typeof v;
        out.push(`${prefix}${k}: ${t}`);
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${prefix}${k}.`, depth + 1, out);
        else if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
            out.push(`${prefix}${k}[0] keys: ${Object.keys(v[0]).slice(0, 40).join(', ')}`);
        }
    }
}
const out = [];
walk(pp, '', 0, out);
console.log(out.slice(0, 200).join('\n'));
