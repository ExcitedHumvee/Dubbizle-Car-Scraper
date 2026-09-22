// Verify full pagination coverage: 10 pages x 1000 hits, zero overlap.
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

(async () => {
    const seen = new Map();
    let total = 0;
    for (let page = 0; page < 10; page++) {
        const r = await post(`/1/indexes/${INDEX}/query`, {
            params: `query=&hitsPerPage=1000&page=${page}&filters=${encodeURIComponent(USED)}`,
        });
        const j = JSON.parse(r.body);
        let newOnes = 0;
        for (const h of j.hits) {
            if (!seen.has(h.objectID)) { seen.set(h.objectID, h); newOnes++; }
        }
        total += j.hits.length;
        console.log(`page ${page}: got=${j.hits.length} new=${newOnes} uniqueTotal=${seen.size} nbHits=${j.nbHits}`);
    }
    console.log(`\nfetched=${total} unique=${seen.size}`);
    const withDetails = [...seen.values()].filter(h => h.details && Object.keys(h.details).length).length;
    const withYear = [...seen.values()].filter(h => h.year !== undefined).length;
    const withKm = [...seen.values()].filter(h => h.kilometers !== undefined).length;
    const withPrice = [...seen.values()].filter(h => typeof h.price === 'number').length;
    console.log(`withDetails=${withDetails} withYear=${withYear} withKm=${withKm} withPrice=${withPrice}`);
})();
