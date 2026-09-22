// Probe: does Googlebot UA bypass the Imperva wall? Is the sitemap readable?
const https = require('https');

const UAS = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    googlebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.0.0 Safari/537.36',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    googlebot_smartphone: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

const URLS = [
    'https://uae.dubizzle.com/sitemaps/sitemap.xml',
    'https://uae.dubizzle.com/motors/used-cars/?sorting=date_desc',
];

function probe(url, uaName) {
    return new Promise((resolve) => {
        const req = https.request(url, {
            method: 'GET',
            headers: {
                'User-Agent': UAS[uaName],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
            },
            timeout: 25000,
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    ua: uaName, status: res.statusCode, len: body.length,
                    blocked: /Pardon Our Interruption|Incapsula|incap_ses/i.test(body),
                    nextData: body.includes('__NEXT_DATA__'),
                    listingCards: (body.match(/data-testid="listing-/g) || []).length,
                    head: body.replace(/\s+/g, ' ').slice(0, 220),
                });
            });
        });
        req.on('timeout', () => { req.destroy(); resolve({ ua: uaName, url, error: 'timeout' }); });
        req.on('error', (e) => resolve({ ua: uaName, url, error: e.message }));
        req.end();
    });
}

(async () => {
    for (const url of URLS) {
        for (const ua of Object.keys(UAS)) {
            const r = await probe(url, ua);
            console.log(`[${ua}] ${url}\n   -> ${JSON.stringify(r)}`);
        }
        console.log('');
    }
})();
