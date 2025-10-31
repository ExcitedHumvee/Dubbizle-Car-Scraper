const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');

async function extractDetailedCarData(page) {
    // ... (This function remains the same as before, it's already robust)
    console.log('Extracting detailed data from page content...');
    const html = await page.content();
    const $ = cheerio.load(html);

    const nextDataElement = $('body').find('#__NEXT_DATA__');
    if (!nextDataElement.length) {
        console.error('Fatal Error: Could not find __NEXT_DATA__ on the page.');
        return [];
    }

    const nextData = JSON.parse(nextDataElement.html());
    const listingsAction = nextData.props.pageProps.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');

    if (!listingsAction?.payload?.hits) {
        console.error('Could not find listings data in __NEXT_DATA__.');
        return [];
    }

    const listings = listingsAction.payload.hits;
    const listingMap = listings.reduce((acc, listing) => {
        acc[listing.uuid] = listing;
        return acc;
    }, {});

    const carListingLocators = await page.locator('a[data-testid^="listing-"]').all();
    console.log(`Found ${carListingLocators.length} listings to process.`);

    const carsOnPage = [];
    for (const listingLocator of carListingLocators) {
        try {
            const detailPageUrl = await listingLocator.getAttribute('href');
            if (!detailPageUrl) continue;

            const listingIdMatch = detailPageUrl.match(/---([a-z0-g]+)/);
            const uuid = listingIdMatch ? listingIdMatch[1] : null;

            if (!uuid || !listingMap[uuid]) {
                console.log(`--> Skipping a listing because its data was not found in the JSON blob. URL: ${detailPageUrl}`);
                continue;
            }

            const listing = listingMap[uuid];
            const details = listing.details || {};

            const titleParts = await listingLocator.locator('[data-testid^="heading-text-"]').allTextContents();
            const location = await listingLocator.locator('.mui-style-t0mppt').textContent();

            carsOnPage.push({
                listingId: uuid, title: titleParts.join(' ').trim(), price: listing.price?.value?.raw || null,
                isNegotiable: listing.price?.value?.negotiable || false, make: details['Make']?.en.value || null,
                model: details['Model']?.en.value || null, year: details['Year']?.en.value || null,
                mileage: listing.mileage?.value?.raw || null, spec: details['Regional Specs']?.en.value?.replace(' Specs', '') || null,
                bodyType: details['Body Type']?.en.value || null, engineCapacity: details['Engine Capacity (cc)']?.en.value || null,
                horsepower: details['Horsepower']?.en.value || null, transmissionType: details['Transmission Type']?.en.value || null,
                fuelType: details['Fuel Type']?.en.value || null, sellerType: details['Seller type']?.en.value || null,
                warranty: details['Warranty']?.en.value || null, location: location.trim(), isPremium: listing.is_premium || false,
                createdAt: listing.created_at ? new Date(listing.created_at * 1000).toISOString() : null,
                detailPageUrl: detailPageUrl ? `https://uae.dubizzle.com${detailPageUrl}` : null,
                thumbnailUrl: listing.images?.[0]?.url || null,
            });
        } catch (error) {
            console.error(`--> An error occurred processing a single car. Skipping it. Error: ${error.message}`);
        }
    }
    return carsOnPage;
}

async function main() {
    let browser;
    try {
        console.log('--- Launching Browser ---');
        browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        console.log('Navigating to Dubizzle Motors...');
        await page.goto('https://uae.dubizzle.com/motors/used-cars/');

        console.log('Checking for cookie banner...');
        try {
            await page.getByRole('button', { name: 'Accept All' }).click({ timeout: 5000 });
            console.log('Cookie banner accepted.');
        } catch (error) {
            console.log('Cookie banner not found or already accepted.');
        }

        console.log('Waiting for initial listings to load...');
        await page.locator('a[data-testid^="listing-"]').first().waitFor();
        console.log('Page is ready.');

        console.log('Applying Sort: "Newest to Oldest"...');
        await page.getByTestId('sort-button').click();
        await page.getByRole('listitem').filter({ hasText: 'Newest to Oldest' }).click();
        await page.waitForURL('**/motors/used-cars/?sorting=date_desc**');

        // --- FIX 1: STABILIZATION ---
        // Wait for the listings to physically appear after sorting. This helps prevent the race condition.
        await page.locator('a[data-testid^="listing-"]').first().waitFor();
        await page.waitForTimeout(1500); // Extra pause for the website's data to settle.
        console.log('Sorting has been applied and page is stable.');

        const allCars = [];
        const seenListingIds = new Set();
        let currentPage = 1;
        const MAX_PAGES = 5;

        while (currentPage <= MAX_PAGES) {
            console.log(`\n--- Scraping Page ${currentPage} ---`);

            const carsFromPage = await extractDetailedCarData(page);
            let newCarsAdded = 0;
            carsFromPage.forEach(car => {
                if (car.listingId && !seenListingIds.has(car.listingId)) {
                    allCars.push(car);
                    seenListingIds.add(car.listingId);
                    newCarsAdded++;
                }
            });
            console.log(`Added ${newCarsAdded} new unique cars from this page.`);
            console.log(`Total unique cars so far: ${allCars.length}`);

            // --- FIX 2: PRECISE SELECTOR ---
            // Use the specific data-testid for the "Next" button.
            const nextButton = page.locator('[data-testid="page-next"]');

            if (await nextButton.isVisible()) {
                console.log('Clicking "Next Page" button...');
                await nextButton.click();

                // --- STABILIZATION (Repeat after every data reload) ---
                await page.locator('a[data-testid^="listing-"]').first().waitFor();
                await page.waitForTimeout(1500); // Pause to let the next page settle.
                currentPage++;
            } else {
                console.log('No "Next Page" button visible. Reached the last page.');
                break;
            }
        }

        console.log('\n--- Scraping Complete ---');
        const outputFilePath = 'scraped-cars.json';
        fs.writeFileSync(outputFilePath, JSON.stringify(allCars, null, 2));
        console.log(`Successfully saved ${allCars.length} unique car listings to ${outputFilePath}`);

    } catch (error) {
        console.error('A critical error occurred during the scraping process:', error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('--- Browser Closed ---');
        }
    }
}

main();