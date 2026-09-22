const fs = require('fs'), cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('Scraper/diag/snap-20260821194928.html', 'utf-8'));
const nd = JSON.parse($('body').find('#__NEXT_DATA__').html());
const act = nd.props.pageProps.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
const pl = act.payload;
console.log('payload keys:', Object.keys(pl));
for (const k of Object.keys(pl)) {
    const v = pl[k];
    console.log(k, '=>', Array.isArray(v) ? `array(${v.length})` : JSON.stringify(v).slice(0, 500));
}

console.log('\n=== pending action (has the query) ===');
const pend = nd.props.pageProps.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/pending');
console.log(JSON.stringify(pend.payload, null, 1).slice(0, 2000));

console.log('\n=== pagination in DOM ===');
const pager = $('[data-testid^="page-"]');
console.log('pager items:', pager.length);
pager.slice(0, 12).each((i, el) => console.log($(el).attr('data-testid'), $(el).attr('href'), $(el).text().trim()));
console.log('next:', $('[data-testid="page-next"]').attr('href'));
console.log('last:', $('[data-testid="page-last"]').attr('href'));
