// Site scoping + sorting + pagination stability checks.
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
            hostname: `${APP_ID}-dsn.algolia.net`, path, method: 'POST',
            headers: {
                'x-algolia-application-id': APP_ID, 'x-algolia-api-key': API_KEY,
                'content-type': 'application/json', 'content-length': payload.length, 'accept-encoding': 'gzip',
            }, timeout: 40000,
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
    // 1) site facet breakdown for used cars
    const f = await query(`query=&hitsPerPage=0&facets=${encodeURIComponent('site.en')}&maxValuesPerFacet=50&filters=${encodeURIComponent(USED)}`);
    console.log('1) site.en breakdown:', JSON.stringify(f.facets && f.facets['site.en'], null, 1));
    console.log('   nbHits:', f.nbHits);

    // 2) sorting by added desc supported?
    const s = await query(`query=&hitsPerPage=3&filters=${encodeURIComponent(USED)}&sort=${encodeURIComponent('added:desc')}`);
    console.log('2) sort=added:desc:', s.error || s.hits.map(h => h.added).join(', '));

    // 3) pagination stability: page0 last vs page1 first with sort
    const p0 = await query(`query=&hitsPerPage=1000&page=0&filters=${encodeURIComponent(USED)}&sort=${encodeURIComponent('added:desc')}`);
    const p1 = await query(`query=&hitsPerPage=1000&page=1&filters=${encodeURIComponent(USED)}&sort=${encodeURIComponent('added:desc')}`);
    console.log('3) p0:', p0.error || `${p0.hits.length} hits, last added=${p0.hits[p0.hits.length - 1].added}`);
    console.log('   p1:', p1.error || `${p1.hits.length} hits, first added=${p1.hits[0].added}`);
    const overlap = new Set(p0.hits.map(h => h.objectID));
    const dup = p1.hits.filter(h => overlap.has(h.objectID)).length;
    console.log('   overlap between page0 and page1:', dup);

    // 4) count for a partition: partition + year split for the biggest make
    const mk = 'motors/used-cars/mercedes-benz';
    const parts = await query(`query=&hitsPerPage=0&facets=${encodeURIComponent('details.Year.en.value')}&maxValuesPerFacet=100&filters=${encodeURIComponent(USED + ` AND category_v2.slug_paths:"${mk}"`)}`);
    console.log('4) mercedes year facet:', JSON.stringify(parts.facets && parts.facets['details.Year.en.value']));
    console.log('   mercedes nbHits:', parts.nbHits);

    // 5) does the key allow distinct / maxValuesPerFacet? try retrieving a record
    const rec = await post(`/1/indexes/${INDEX}/query`, { params: 'query=&hitsPerPage=1' });
    const j = JSON.parse(rec.body);
    console.log('5) record fetch via query ok, keys:', Object.keys(j.hits[0]).length);
})();
