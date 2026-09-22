const fs = require('fs'), cheerio = require('cheerio');
const html = fs.readFileSync('Scraper/diag/snap-20260821194928.html', 'utf-8');
const $ = cheerio.load(html);
const cards = $('a[data-testid^="listing-"]');
console.log('cards:', cards.length);

function classesIn(el, set) {
    el.find('*').each((i, e) => {
        const c = $(e).attr('class');
        if (c) c.split(/\s+/).forEach(x => set.add(x));
    });
}

// figure out which card is the LPV grid card vs carousel
cards.each((i, el) => {
    const card = $(el);
    const href = card.attr('href') || '';
    const testids = card.find('[data-testid]').map((j, e) => $(e).attr('data-testid')).get();
    const texts = card.find('p,span').map((j, e) => $(e).text().trim()).get().filter(Boolean).slice(0, 12);
    if (i < 3) {
        console.log(`\n--- card ${i} href=${href.slice(0, 80)}`);
        console.log('testids:', JSON.stringify(testids));
        console.log('texts:', JSON.stringify(texts));
    }
});

console.log('\n=== all data-testids used inside cards (unique) ===');
const ids = new Set();
cards.each((i, el) => $(el).find('[data-testid]').each((j, e) => ids.add($(e).attr('data-testid'))));
console.log([...ids].sort().join('\n'));
