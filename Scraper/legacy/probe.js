// Probe several Dubizzle / DLAPI endpoints with plain HTTP to map where the WAF bites.
const https = require('https');

const targets = [
    'https://uae.dubizzle.com/motors/used-cars/?sorting=date_desc',
    'https://dubai.dubizzle.com/motors/used-cars/',
    'https://www.dubizzle.com/',
    'https://uae.dubizzle.com/robots.txt',
    'https://uae.dubizzle.com/sitemap.xml',
    'https://dubai.dubizzle.com/sitemap.xml',
    'https://uae.dubizzle.com/api/',
    'https://api.dubizzle.com/',
    'https://dubizzle.com/',
];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1',
};

function probe(url) {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'GET', headers: HEADERS, timeout: 20000 }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    url,
                    status: res.statusCode,
                    len: body.length,
                    country: res.headers['x-country-code'] || '',
                    server: res.headers['server'] || '',
                    blocked: /Pardon Our Interruption|Incapsula|incap_ses|hcaptcha/i.test(body),
                    nextData: body.includes('__NEXT_DATA__'),
                    redirect: res.headers.location || '',
                    head: body.replace(/\s+/g, ' ').slice(0, 160),
                });
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ url, error: 'timeout' }); });
        req.on('error', (e) => resolve({ url, error: e.message }));
        req.end();
    });
}

(async () => {
    for (const t of targets) {
        const r = await probe(t);
        console.log(JSON.stringify(r));
    }
})();
