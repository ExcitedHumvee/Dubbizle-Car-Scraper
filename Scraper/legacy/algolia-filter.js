// Verify filtering + pagination depth on the Algolia index (this is the whole scrape).
const https = require('https');
const zlib = require('zlib');

const APP_ID = 'WD0PTZ13ZS';
const API_KEY = 'cdd839b4fdac840289e88633779e8634';
const INDEX = 'motors.com';

function post(path, body) {
    return new Promise((resolve) => {
        const payload = Buffer.from(JSON.stringify(body));
        const req = https.request({
            hostname: `${APP_ID}-dsn.algolia.net`,
            path, method: 'POST',
            headers: {
                'x-algolia-application-id': APP_ID,
                'x-algolia-api-key': API_KEY,
                'content-type': 'application/json',
                'content-length': payload.length,
                'accept-encoding': 'gzip',
            },
            timeout: 40000,
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                try { if ((res.headers['content-encoding'] || '') === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) {}
                resolve({ status: res.statusCode, body: buf.toString('utf-8') });
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.write(payload); req.end();
    });
}

async function q(params) {
    const r = await post(`/1/indexes/${INDEX}/query`, { params });
    if (r.status !== 200) throw new Error(`status ${r.status}: ${r.body.slice(0, 200)}`);
    return JSON.parse(r.body);
}

(async () => {
    // A) exact filter the LPV would use
    const a = await q('query=&hitsPerPage=1&filters=category_v2.slug_paths%3A%22motors%2Fused-cars%22');
    console.log('A filter used-cars:', { nbHits: a.nbHits, nbPages: a.nbPages, hitsPerPage: a.hitsPerPage });

    // B) facetFilters variant
    const b = await q('query=&hitsPerPage=1&facetFilters=' + encodeURIComponent(JSON.stringify([['category_v2.slug_paths:motors/used-cars']])));
    console.log('B facetFilters used-cars:', { nbHits: b.nbHits, nbPages: b.nbPages });

    // C) how deep can we page? Algolia paginationLimitedTo is often 1000
    for (const page of [0, 999, 1000, 1001, 1300, 3333]) {
        try {
            const r = await q(`query=&hitsPerPage=20&page=${page}&filters=${encodeURIComponent('category_v2.slug_paths:"motors/used-cars"')}`);
            console.log(`C page ${page}: hits=${r.hits.length} nbHits=${r.nbHits} nbPages=${r.nbPages} message=${r.message || ''}`);
        } catch (e) {
            console.log(`C page ${page}: ERROR ${e.message.slice(0, 160)}`);
        }
    }

    // D) sort options the site advertises (replicas)
    const base = await q('query=&hitsPerPage=0');
    console.log('\nD sort indices referenced in the page payload: by_year_asc_motors.com / by_year_desc_motors.com etc.');

    // E) sample used-car hit: does it carry details + kilometers + year?
    const s = await q(`query=&hitsPerPage=3&filters=${encodeURIComponent('category_v2.slug_paths:"motors/used-cars"')}`);
    const h = s.hits[0];
    console.log('\nE sample used-car hit:');
    console.log(JSON.stringify({
        id: h.id, uuid: h.uuid, name: h.name && h.name.en, price: h.price, year: h.year,
        kilometers: h.kilometers, seller_type: h.seller_type, added: h.added, created_at: h.created_at,
        body_type: h.body_type, motors_trim: h.motors_trim, category_v2: h.category_v2,
        site: h.site, location: h.places, is_premium: h.is_premium, photos_count: h.photos_count,
        uri: h.uri, absolute_url: h.absolute_url,
    }, null, 1));
    console.log('\nE details keys:', h.details ? Object.keys(h.details).join(', ') : '(none)');
})();
