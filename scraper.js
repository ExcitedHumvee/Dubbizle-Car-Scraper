const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs'); // File System module for writing files
const path = require('path'); // Path module for creating file paths

// Configuration
const BASE_URL = 'https://dubai.dubizzle.com/motors/used-cars/';
const FIRST_PAGE = 1;
const LAST_PAGE = 400; // do not go greater than 400
const SAVE_HTML_PAGES = false;
const CONCURRENT_PAGES = 10;
const TIMEOUT = 30; // seconds

if (SAVE_HTML_PAGES === false) {
    console.warn('WARNING: SAVE_HTML_PAGES is set to false. Raw HTML pages will not be saved.');
}

// --- Setup Directories ---
const htmlDir = path.join(__dirname, 'html_files');
const errorsDir = path.join(__dirname, 'errors');
const unprocessedDir = path.join(__dirname, 'unprocessed');
const processedDir = path.join(__dirname, 'processed');

if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}
if (!fs.existsSync(errorsDir)) {
    fs.mkdirSync(errorsDir, { recursive: true });
}
if (!fs.existsSync(unprocessedDir)) {
    fs.mkdirSync(unprocessedDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
}

async function scrapePage(browser, pageNum) {
    const url = `${BASE_URL}?page=${pageNum}`;
    console.log(`Navigating to: ${url}`);
    let context;
    try {
        context = await browser.newContext();
        const page = await context.newPage();
        const carsOnPage = [];

        await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT * 1000 });

        // --- POP-UP HANDLING ---
        try {
            await page.waitForSelector('a[data-testid^="listing-"], #moe-dontallow_button, [data-testid="close-button"]', { timeout: TIMEOUT * 1000 });

            if (await page.isVisible('#moe-dontallow_button')) {
                console.log('Notifications pop-up found. Clicking "Don\'t Allow".');
                await page.click('#moe-dontallow_button');
            }

            if (await page.isVisible('[data-testid="close-button"]')) {
                console.log('Community banner found. Clicking close.');
                await page.click('[data-testid="close-button"]');
            }
        } catch (e) {
            console.log('No pop-ups found or main content loaded directly.');
        }

        // --- MAIN SCRAPING LOGIC ---
        const LISTING_CARD_SELECTOR = 'a[data-testid^="listing-"]';
        await page.waitForSelector(LISTING_CARD_SELECTOR, { timeout: TIMEOUT * 1000 });

        const html = await page.content();

        if (SAVE_HTML_PAGES) {
            const htmlFilePath = path.join(htmlDir, `page_${pageNum}.html`);
            fs.writeFileSync(htmlFilePath, html);
            console.log(`Raw HTML for page ${pageNum} has been saved to: ${htmlFilePath}`);
        }

        const $ = cheerio.load(html);

        const nextData = JSON.parse($('body').find('#__NEXT_DATA__').html());
        const listingsAction = nextData.props.pageProps.reduxWrapperActionsGIPP.find(a => a.type === 'listings/fetchListingDataForQuery/fulfilled');
        const listings = listingsAction ? listingsAction.payload.hits : [];

        const listingMap = listings.reduce((acc, listing) => {
            acc[listing.uuid] = listing;
            return acc;
        }, {});

        const carListings = $(LISTING_CARD_SELECTOR);
        console.log(`Found ${carListings.length} car listings on page ${pageNum}.`);

        carListings.each((index, element) => {
            const card = $(element);

            const titleParts = [];
            card.find('[data-testid^="heading-text-"]').each((i, el) => {
                titleParts.push($(el).text().trim());
            });
            const title = titleParts.join(' ');

            const detailPageUrl = card.attr('href');
            const listingIdMatch = detailPageUrl ? detailPageUrl.match(/---([a-z0-9]+)/) : null;
            const uuid = listingIdMatch ? listingIdMatch[1] : null;
            const listing = listingMap[uuid] || {};
            const details = listing.details || {};

            carsOnPage.push({
                listingId: uuid,
                detailPageUrl: detailPageUrl ? `https://dubai.dubizzle.com${detailPageUrl}` : null,
                title: title,
                price: listing.price || null,
                sellerType: details['Seller type']?.en.value || null,
                isNegotiable: card.text().toLowerCase().includes('negotiable'),
                thumbnailUrl: card.find('img').attr('src'),
                year: parseInt(card.find('[data-testid="listing-year"]').text().trim(), 10) || null,
                mileage: parseInt(card.find('[data-testid="listing-kms"]').text().trim().replace(/,/g, ''), 10) || null,
                location: card.find('.mui-style-t0mppt').text().trim(),
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
                createdAt: listing.created_at ? new Date(listing.created_at * 1000).toISOString() : null,
                isVerifiedUser: listing.is_verified_user || null,
                isPremium: listing.is_premium || null,
                neighbourhood: listing.neighbourhood?.en || null,
                added: listing.added ? new Date(listing.added * 1000).toISOString() : null,
            });
        });
        return { success: true, cars: carsOnPage };
    } catch (error) {
        console.error(`An error occurred on page ${pageNum}:`, error.message);
        const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
        const errorFileName = `error_page_${pageNum}_${timestamp}`;

        // *** SAVE ERROR HTML ***
        const errorHtmlPath = path.join(htmlDir, `${errorFileName}.html`);
        try {
            const page = await browser.newPage();
            const html = await page.content();
            fs.writeFileSync(errorHtmlPath, html);
            console.error(`Error HTML saved to: ${errorHtmlPath}`);
        } catch (htmlError) {
            console.error(`Could not save error HTML for page ${pageNum}:`, htmlError.message);
        }

        // *** SAVE ERROR SCREENSHOT ***
        const errorScreenshotPath = path.join(errorsDir, `${errorFileName}.png`);
        try {
            const page = await browser.newPage();
            await page.goto(url);
            await page.screenshot({ path: errorScreenshotPath });
            console.error(`Error screenshot saved to: ${errorScreenshotPath}`);
        } catch (screenshotError) {
            console.error(`Could not save error screenshot for page ${pageNum}:`, screenshotError.message);
        }

        return { success: false, url: url };
    } finally {
        if (context) {
            await context.close();
        }
    }
}

async function scrapeCars() {
    const startTime = new Date();
    console.log('--- Launching browser ---');
    const browser = await chromium.launch({ headless: false });
    const allCars = [];
    let successfulPages = 0;
    let unsuccessfulPages = 0;
    const unsuccessfulPageUrls = [];

    const pageNumbers = [];
    for (let i = FIRST_PAGE; i <= LAST_PAGE; i++) {
        pageNumbers.push(i);
    }

    async function scrapeWorker(pageNumber) {
        const result = await scrapePage(browser, pageNumber);
        if (result.success) {
            allCars.push(...result.cars);
            successfulPages++;
        } else {
            unsuccessfulPages++;
            unsuccessfulPageUrls.push(result.url);
        }
    }

    const workers = [];
    for (let i = 0; i < CONCURRENT_PAGES; i++) {
        const pageNum = pageNumbers.shift();
        if (pageNum) {
            workers.push(scrapeWorker(pageNum));
        }
    }

    let currentTask = 0;
    while (pageNumbers.length > 0) {
        await workers[currentTask];
        const pageNum = pageNumbers.shift();
        if (pageNum) {
            workers[currentTask] = scrapeWorker(pageNum);
        }
        currentTask = (currentTask + 1) % CONCURRENT_PAGES;
    }

    await Promise.all(workers);


    await browser.close();
    console.log('--- Browser closed ---');

    const endTime = new Date();
    const runTime = (endTime - startTime) / 1000;
    const completionDate = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const outputFilePath = path.join(unprocessedDir, `${completionDate}-${allCars.length}.json`);

    fs.writeFileSync(outputFilePath, JSON.stringify(allCars, null, 2));

    console.log('--- Scraping Summary ---');
    console.log(`Total cars scraped: ${allCars.length}`);
    console.log(`Successful pages: ${successfulPages}`);
    console.log(`Unsuccessful pages: ${unsuccessfulPages}`);
    if (unsuccessfulPages > 0) {
        console.log('Unsuccessful page URLs:');
        unsuccessfulPageUrls.forEach(url => console.log(`- ${url}`));
    }
    console.log(`Total run time: ${runTime} seconds`);
    console.log(`Scraped data saved to: ${outputFilePath}`);
}


scrapeCars();
