// Discover the exact filter Dubizzle's LPV uses, by inspecting facets and hit structure.
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
            timeout: 30000,
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
    if (r.status !== 200) return { error: r.body.slice(0, 300) };
    return JSON.parse(r.body);
}

(async () => {
    // 1) hit structure
    const base = await q('query=&hitsPerPage=3');
    console.log('=== unfiltered ===', { nbHits: base.nbHits, nbPages: base.nbPages });
    const h = base.hits[0];
    console.log('\n=== sample hit relevant fields ===');
    for (const k of ['id', 'uuid', 'objectID', 'name', 'price', 'content_type', 'site', 'site_categories_slug_tree', 'category', 'category_v2', 'location_list', 'places', 'added', 'created_at', 'is_premium', 'seller_type', 'seller', 'details']) {
        if (h[k] !== undefined) console.log(k, '=>', JSON.stringify(h[k]).slice(0, 300));
    }
    console.log('\n=== ALL hit keys ===');
    console.log(Object.keys(h).sort().join('\n'));

    // 2) facets to find the used-cars path
    const f = await q('query=&hitsPerPage=0&facets=*&maxValuesPerFacet=40');
    console.log('\n=== facet names ===');
    console.log(Object.keys(f.facets || {}).join('\n'));
    const interesting = ['site_categories_slug_tree', 'content_type', 'category.slug', 'site.slug', 'category_v2.slug_paths'];
    for (const k of interesting) {
        if (f.facets && f.facets[k]) {
            console.log(`\n=== facet ${k} ===`);
            console.log(JSON.stringify(f.facets[k], null, 1).slice(0, 2500));
        }
    }
})();
