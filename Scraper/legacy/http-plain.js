// Diagnostic: can a plain HTTP client get the page, or is it captcha-walled?
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const url = 'https://uae.dubizzle.com/motors/used-cars/?sorting=date_desc';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
};

const req = https.request(url, { method: 'GET', headers }, (res) => {
    console.log('status:', res.statusCode);
    console.log('headers:', JSON.stringify(res.headers, null, 2));

    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
        let buf = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
            if (enc === 'gzip') buf = zlib.gunzipSync(buf);
            else if (enc === 'deflate') buf = zlib.inflateSync(buf);
            else if (enc === 'br') buf = zlib.brotliDecompressSync(buf);
        } catch (e) {
            console.log('decompress error', e.message);
        }
        const html = buf.toString('utf-8');
        console.log('bytes:', html.length);
        const out = path.join(__dirname, 'plain-http.html');
        fs.writeFileSync(out, html);
        console.log('saved', out);

        console.log('has __NEXT_DATA__:', html.includes('__NEXT_DATA__'));
        console.log('has listing- testid:', html.includes('data-testid="listing-'));
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        console.log('title:', titleMatch ? titleMatch[1].trim().slice(0, 200) : '(none)');
        console.log('captcha hints:', /captcha|datadome|px-captcha|perimeterx|hcaptcha|recaptcha|challenge/i.test(html));
        console.log('--- head 1500 ---');
        console.log(html.slice(0, 1500));
    });
});
req.on('error', (e) => console.error('REQ ERROR', e.message));
req.end();
