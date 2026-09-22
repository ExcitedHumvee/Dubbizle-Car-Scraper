const fs = require('fs'), cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('Scraper/diag/snap-20260821194928.html', 'utf-8'));
const html = $.html();

const needles = ['ALGOLIA_HOST', 'algolia_app_id', 'algolia_app_key', 'algolia-api-key', 'algolia-application-id', 'algolia.dubizzle.com', 'ALGOLIA_HOST_INDEXES', 'ALGOLIA_HOST_SITES', 'algolia.net'];
for (const n of needles) {
    console.log(`\n===== ${n} =====`);
    let idx = -1, count = 0;
    while ((idx = html.indexOf(n, idx + 1)) !== -1 && count < 4) {
        count++;
        console.log('...' + html.slice(Math.max(0, idx - 260), idx + 400).replace(/\s+/g, ' ') + '...');
        console.log('---');
    }
}
