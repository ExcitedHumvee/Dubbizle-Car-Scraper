const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, 'html_files');
const allCars = [];

function parseHtmlFile(filePath) {
    console.log(`--- Parsing ${path.basename(filePath)} ---`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    const nextData = JSON.parse($('#__NEXT_DATA__').html());
    const listingsAction = nextData.props.pageProps.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
    const listings = listingsAction ? listingsAction.payload.hits : [];

    const listingDetailsMap = listings.reduce((acc, listing) => {
        acc[listing.uuid] = listing.details;
        return acc;
    }, {});

    const LISTING_CARD_SELECTOR = 'a[data-testid^="listing-"]';
    const carListings = $(LISTING_CARD_SELECTOR);
    console.log(`Found ${carListings.length} car listings.`);

    carListings.each((index, element) => {
        const card = $(element);

        const titleParts = [];
        card.find('[data-testid^="heading-text-"]').each((i, el) => {
            titleParts.push($(el).text().trim());
        });
        const title = titleParts.join(' ');

        const priceText = card.find('[data-testid="listing-price"]').text().trim();
        const [currency, ...priceParts] = priceText.split(' ');
        const price = priceParts.join('');

        const detailPageUrl = card.attr('href');
        const listingIdMatch = detailPageUrl ? detailPageUrl.match(/---([a-z0-9]+)/) : null;
        const uuid = listingIdMatch ? listingIdMatch[1] : null;
        const details = listingDetailsMap[uuid] || {};

        allCars.push({
            listingId: uuid,
            detailPageUrl: detailPageUrl ? `https://dubai.dubizzle.com${detailPageUrl}` : null,
            title: title,
            price: price ? parseInt(price.replace(/,/g, ''), 10) : null,
            currency: currency.replace('undefined\n', '').trim() || 'AED',
            sellerType: details['Seller type']?.en.value || null,
            isNegotiable: card.text().toLowerCase().includes('negotiable'),
            thumbnailUrl: card.find('img').attr('src'),
            year: parseInt(card.find('[data-testid="listing-year"]').text().trim(), 10) || null,
            mileage: parseInt(card.find('[data-testid="listing-kms"]').text().trim().replace(/,/g, ''), 10) || null,
            location: card.find('.mui-style-t0mppt').text().trim(),
            postedDate: card.find('[data-testid="listing-posted-date"]').text().trim() || null,
            badges: card.find('[data-testid*="-badge"]').map((i, el) => $(el).text().trim().replace('undefined', '')).get(),
            interiorColor: details['Interior Color']?.en.value || null,
            horsepower: details['Horsepower']?.en.value || null,
            exteriorColor: details['Exterior Color']?.en.value || null,
            doors: details['Doors']?.en.value || null,
            bodyType: details['Body Type']?.en.value || null,
            seatingCapacity: details['Seating Capacity']?.en.value || null,
            cylinders: details['No. of Cylinders']?.en.value || null,
            transmissionType: details['Transmission Type']?.en.value || null,
            engineCapacity: details['Engine Capacity (cc)']?.en.value || null,
            extras: details['Extras']?.en.value || [],
            technicalFeatures: details['Technical Features']?.en.value || [],
            trim: details['Trim']?.en.value || null,
            warranty: details['Warranty']?.en.value || null,
            fuelType: details['Fuel Type']?.en.value || null,
            vehicleReference: details['Vehicle Reference']?.en.value || null,
            make: details['Make']?.en.value || null,
            model: details['Model']?.en.value || null,
            motorsTrim: details['Motors Trim']?.en.value || null,
        });
    });
}

function processHtmlFiles() {
    fs.readdir(htmlDir, (err, files) => {
        if (err) {
            console.error('Error reading html_files directory:', err);
            return;
        }

        files.forEach(file => {
            if (path.extname(file) === '.html') {
                parseHtmlFile(path.join(htmlDir, file));
            }
        });

        console.log('\n--- Final Scraped Data ---');
        console.log(JSON.stringify(allCars, null, 2));
        console.log(`\nTotal cars scraped: ${allCars.length}`);
    });
}

processHtmlFiles();
