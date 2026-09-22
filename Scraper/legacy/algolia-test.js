// Test direct Algolia queries (the real Dubizzle data source) from this datacenter IP.
const https = require('https');
const zlib = require('zlib');

const APP_ID = process.env.APP_ID || 'WD0PTZ13ZS';
const API_KEY = process.env.API_KEY || 'cdd839b4fdac840289e88633779e8634';
const INDEX = process.env.INDEX || 'motors.com';

function post(hostname, path, body, extraHeaders = {}) {
    return new Promise((resolve) => {
        const payload = Buffer.from(JSON.stringify(body));
        const req = https.request({
            hostname,
            path,
            method: 'POST',
            headers: {
                'x-algolia-application-id': APP_ID,
                'x-algolia-api-key': API_KEY,
                'content-type': 'application/json',
                'content-length': payload.length,
                'accept-encoding': 'gzip',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                ...extraHeaders,
            },
            timeout: 30000,
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                const enc = (res.headers['content-encoding'] || '').toLowerCase();
                try { if (enc === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) {}
                resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf-8') });
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
        req.on('error', (e) => resolve({ status: 0, error: e.message }));
        req.write(payload);
        req.end();
    });
}

const HOSTS = [
    { name: 'dsn.algolia.net', hostname: `${APP_ID}-dsn.algolia.net` },
    { name: 'algolia.net', hostname: `${APP_ID}.algolia.net` },
    { name: 'custom host', hostname: 'algolia.dubizzle.com' },
];

(async () => {
    for (const h of HOSTS) {
        console.log(`\n########## ${h.name} (${h.hostname}) ##########`);
        // 1) simple query
        const r1 = await post(h.hostname, `/1/indexes/${INDEX}/query`, { query: '', hitsPerPage: 2 });
        console.log('query:', r1.status, r1.error || '', (r1.body || '').slice(0, 400).replace(/\s+/g, ' '));
        if (r1.status === 200) {
            try {
                const j = JSON.parse(r1.body);
                console.log('  nbHits:', j.nbHits, 'nbPages:', j.nbPages, 'hits:', j.hits.length);
                console.log('  hit0 keys:', Object.keys(j.hits[0] || {}).slice(0, 25).join(', '));
                console.log('  hit0 name:', JSON.stringify(j.hits[0] && j.hits[0].name));
                console.log('  hit0 price:', j.hits[0] && j.hits[0].price, 'details?', !!(j.hits[0] && j.hits[0].details));
            } catch (e) { console.log('  parse fail', e.message); }
        }
        // 2) multi-queries (what the site actually calls)
        const r2 = await post(h.hostname, '/1/indexes/*/queries', {
            requests: [{ indexName: INDEX, params: 'query=&hitsPerPage=2&page=0' }],
        });
        console.log('multi-queries:', r2.status, r2.error || '', (r2.body || '').slice(0, 300).replace(/\s+/g, ' '));
    }
})();
