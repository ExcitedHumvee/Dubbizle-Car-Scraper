// Fetch the newest wayback snapshot of the used-cars listing page and analyse __NEXT_DATA__.
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
                'Accept': 'text/html,application/json,*/*',
                'Accept-Encoding': 'gzip, deflate',
            },
            timeout: 120000,
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

const TS = process.env.TS || '20260821194928';
const target = `https://web.archive.org/web/${TS}id_/https://uae.dubizzle.com/motors/used-cars/`;

(async () => {
    console.log('fetching', target);
    const r = await get(target);
    console.log('status', r.status, 'len', r.body.length);
    const out = path.join(__dirname, `snap-${TS}.html`);
    fs.writeFileSync(out, r.body);
    console.log('saved', out);
    console.log('has __NEXT_DATA__:', r.body.includes('__NEXT_DATA__'));
    console.log('listing cards:', (r.body.match(/data-testid="listing-/g) || []).length);
})().catch(e => console.error('ERR', e.message));
