// Parse every snapshot in the corpus with the CURRENT data path and report coverage.
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const dir = path.join(__dirname, 'snaps');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
files.push(path.join('..', 'snap-20260821194928.html'));

function firstActionHits(nd) {
    const acts = (nd.props && nd.props.pageProps && nd.props.pageProps.reduxWrapperActionsGIPP) || [];
    const act = acts.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
    return (act && act.payload && act.payload.hits) || null;
}

let grand = { cards: 0, hits: 0, merged: 0, withPrice: 0, withMileage: 0, withYear: 0, withMake: 0, withSpec: 0 };
for (const f of files) {
    const full = f.includes(path.sep) ? path.join(__dirname, f) : path.join(dir, f);
    if (!fs.existsSync(full)) { console.log('missing', full); continue; }
    const $ = cheerio.load(fs.readFileSync(full, 'utf-8'));
    const raw = $('body').find('#__NEXT_DATA__').html();
    if (!raw) { console.log(`${f}: NO NEXT_DATA`); continue; }
    const nd = JSON.parse(raw);
    const hits = firstActionHits(nd);
    const cards = $('a[data-testid^="listing-"]');

    const byUuid = new Map();
    (hits || []).forEach(h => byUuid.set(h.uuid, h));

    let merged = 0, withPrice = 0, withMileage = 0, withYear = 0, withMake = 0, withSpec = 0;
    cards.each((i, el) => {
        const card = $(el);
        const href = card.attr('href') || '';
        const m = href.match(/---([a-z0-9]+)/);
        const uuid = m ? m[1] : null;
        const hit = uuid ? byUuid.get(uuid) : null;
        const d = (hit && hit.details) || {};
        if (hit) merged++;
        const price = hit && typeof hit.price === 'number' ? hit.price : parseInt((card.find('[data-testid="listing-price"]').text() || '').replace(/[^0-9]/g, ''), 10);
        const kms = parseInt((card.find('[data-testid="listing-kms"]').text() || '').replace(/[^0-9]/g, ''), 10);
        const year = parseInt((card.find('[data-testid="listing-year"]').text() || '').trim(), 10);
        if (Number.isFinite(price)) withPrice++;
        if (Number.isFinite(kms)) withMileage++;
        if (Number.isFinite(year)) withYear++;
        if (d['Make'] && d['Make'].en && d['Make'].en.value) withMake++;
        if (d['Regional Specs']) withSpec++;
    });

    console.log(`${path.basename(f)}: cards=${cards.length} hits=${hits ? hits.length : 'none'} merged=${merged} price=${withPrice} kms=${withMileage} year=${withYear} make=${withMake} spec=${withSpec}`);
    grand.cards += cards.length; grand.hits += hits ? hits.length : 0; grand.merged += merged;
    grand.withPrice += withPrice; grand.withMileage += withMileage; grand.withYear += withYear; grand.withMake += withMake; grand.withSpec += withSpec;
}
console.log('\nTOTAL', JSON.stringify(grand, null, 1));
