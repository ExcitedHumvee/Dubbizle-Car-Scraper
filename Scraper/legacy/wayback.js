// Fetch a recent Wayback snapshot of the Dubizzle used-cars page and dump its structure.
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function get(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json,text/html,*/*',
                'Accept-Encoding': 'gzip, deflate',
            },
            timeout: 60000,
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
                res.resume();
                const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
                return resolve(get(next, redirects + 1));
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                const enc = (res.headers['content-encoding'] || '').toLowerCase();
                try {
                    if (enc === 'gzip') buf = zlib.gunzipSync(buf);
                    else if (enc === 'deflate') buf = zlib.inflateSync(buf);
                } catch (e) { /* ignore */ }
                resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf-8') });
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    const cdx = 'https://web.archive.org/cdx/search/cdx?url=uae.dubizzle.com/motors/used-cars*&output=json&limit=40&from=20251001&filter=statuscode:200&collapse=timestamp:8';
    const r = await get(cdx);
    console.log('cdx status', r.status);
    console.log(r.body.slice(0, 3000));
    fs.writeFileSync(path.join(__dirname, 'cdx.json'), r.body);
})().catch(e => console.error('ERR', e.message));
