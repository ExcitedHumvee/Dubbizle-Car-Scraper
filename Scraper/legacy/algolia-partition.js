// Verify browse access, numeric filters, and partitioning strategy (make -> year) to beat the 10k cap.
const https = require('https');
const zlib = require('zlib');

const APP_ID = 'WD0PTZ13ZS';
const API_KEY = 'cdd839b4fdac840289e88633779e8634';
const INDEX = 'motors.com';
const USED = 'category_v2.slug_paths:"motors/used-cars"';

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

async function query(params) {
    const r = await post(`/1/indexes/${INDEX}/query`, { params });
    if (r.status !== 200) return { error: `${r.status} ${r.body.slice(0, 200)}` };
    return JSON.parse(r.body);
}

(async () => {
    // 1) hitsPerPage = 1000 allowed?
    const big = await query(`query=&hitsPerPage=1000&page=0&filters=${encodeURIComponent(USED)}`);
    console.log('1) hitsPerPage=1000 =>', big.error || `hits=${big.hits.length} nbHits=${big.nbHits} nbPages=${big.nbPages}`);

    // 2) browse endpoint?
    const brow = await post(`/1/indexes/${INDEX}/browse`, { params: `query=&hitsPerPage=10&filters=${encodeURIComponent(USED)}` });
    console.log('2) browse =>', brow.status, brow.body.slice(0, 200).replace(/\s+/g, ' '));

    // 3) numeric filter on year
    const yf = await query(`query=&hitsPerPage=1&filters=${encodeURIComponent(USED + ' AND year>=2015')}`);
    console.log('3) year>=2015 =>', yf.error || `nbHits=${yf.nbHits}`);

    // 4) numeric filter on kilometers
    const kf = await query(`query=&hitsPerPage=1&filters=${encodeURIComponent(USED + ' AND kilometers<50000')}`);
    console.log('4) kilometers<50000 =>', kf.error || `nbHits=${kf.nbHits}`);

    // 5) partition by make: how many sub-paths are there and what are their counts?
    const f = await query('query=&hitsPerPage=0&facets=' + encodeURIComponent('category_v2.slug_paths') + '&maxValuesPerFacet=1000&filters=' + encodeURIComponent(USED));
    const usedFacet = (f.facets && f.facets['category_v2.slug_paths']) || {};
    const makes = Object.entries(usedFacet)
        .filter(([k]) => /^motors\/used-cars\/[^/]+$/.test(k))
        .sort((a, b) => b[1] - a[1]);
    console.log(`5) make partitions: ${makes.length}; top:`, makes.slice(0, 5));
    console.log('   any make over 10k?', makes.filter(([, c]) => c > 10000));

    // 6) sum of make counts vs total (do partitions cover everything?)
    const sum = makes.reduce((a, [, c]) => a + c, 0);
    console.log(`6) sum(makes)=${sum} usedTotal=${usedFacet['motors/used-cars']}`);

    // 7) maxValuesPerFacet respected?
    console.log(`7) facet values returned: ${Object.keys(usedFacet).length}`);

    // 8) replica sort index works?
    const rep = await post(`/1/indexes/motors.com/query`, { params: `query=&hitsPerPage=1&filters=${encodeURIComponent(USED)}` });
    console.log('8) base ok:', rep.status);
})();
