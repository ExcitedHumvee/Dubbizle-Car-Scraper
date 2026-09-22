// Can we fetch a page from the slug endpoint (for auto-refreshing credentials)?
const https = require('https');
const zlib = require('zlib');

function get(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Encoding': 'gzip, deflate',
            }, timeout: 45000,
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
                res.resume();
                const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
                return resolve(get(next, redirects + 1));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                const enc = (res.headers['content-encoding'] || '').toLowerCase();
                try { if (enc === 'gzip') buf = zlib.gunzipSync(buf); else if (enc === 'deflate') buf = zlib.inflateSync(buf); } catch (e) {}
                resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf-8'), url });
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    for (const u of ['https://dubizzle.com/s/DOBImcg', 'https://uae.dubizzle.com/countries/4/listings/aXRlbTo0OjI6MTM4OToxNjk3MDQ0OQ==/']) {
        try {
            const r = await get(u);
            console.log(u, '->', r.status, 'final:', r.url, 'len:', r.body.length,
                'nextData:', r.body.includes('__NEXT_DATA__'),
                'appId:', (r.body.match(/algolia_app_id":"([^"]+)/) || [])[1] || '-',
                'appKey:', (r.body.match(/algolia_app_key":"([^"]+)/) || [])[1] || '-',
                'blocked:', /Pardon Our Interruption|Incapsula/i.test(r.body));
        } catch (e) {
            console.log(u, 'ERR', e.message);
        }
    }
})();
