const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs'); // File System module for writing files
const path = require('path'); // Path module for creating file paths

const BASE_URL = 'https://dubai.dubizzle.com/motors/used-cars/';

// --- Setup Directories ---
const htmlDir = path.join(__dirname, 'html_files');
const errorsDir = path.join(__dirname, 'errors');

if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}
if (!fs.existsSync(errorsDir)) {
    fs.mkdirSync(errorsDir, { recursive: true });
}

async function scrapeCars() {
    console.log('--- Launching browser ---');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const allCars = [];

    // Scrape the first 2 pages
    for (let pageNum = 1; pageNum <= 2; pageNum++) {
        const url = `${BASE_URL}?page=${pageNum}`;
        console.log(`
--- Scraping Page ${pageNum} ---`);
        console.log(`Navigating to: ${url}`);

        try {
            console.log('>>> ACTION REQUIRED: If a CAPTCHA appears, please solve it in the browser window.');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

            console.log('Page loaded. Looking for pop-ups and listings...');

            // --- POP-UP HANDLING ---
            try {
                await page.waitForSelector('a[data-testid^="listing-"], #moe-dontallow_button, [data-testid="close-button"]', { timeout: 5000 });

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
            await page.waitForSelector(LISTING_CARD_SELECTOR, { timeout: 5000 });
            console.log('Listings found. Extracting data...');

            const html = await page.content();

            // *** SAVE RAW HTML TO FILE ***
            const htmlFilePath = path.join(htmlDir, `page_${pageNum}.html`);
            fs.writeFileSync(htmlFilePath, html);
            console.log(`Raw HTML for page ${pageNum} has been saved to: ${htmlFilePath}`);

            const $ = cheerio.load(html);

            const carListings = $(LISTING_CARD_SELECTOR);
            console.log(`Found ${carListings.length} car listings on page ${pageNum}.`);

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

                allCars.push({
                    listingId: detailPageUrl ? detailPageUrl.match(/\/([^/]+)\/$/)?.[1] : null,
                    detailPageUrl: detailPageUrl ? `https://dubai.dubizzle.com${detailPageUrl}` : null,
                    title: title,
                    price: price ? parseInt(price.replace(/,/g, ''), 10) : null,
                    currency: currency || 'AED',
                    isNegotiable: card.text().toLowerCase().includes('negotiable'),
                    thumbnailUrl: card.find('img').attr('src'),
                    year: parseInt(card.find('[data-testid="listing-year"]').text().trim(), 10) || null,
                    mileage: parseInt(card.find('[data-testid="listing-kms"]').text().trim().replace(/,/g, ''), 10) || null,
                    location: card.find('.mui-style-t0mppt').text().trim(),
                    postedDate: card.find('[data-testid="listing-posted-date"]').text().trim() || null,
                    badges: card.find('[data-testid*="-badge"]').map((i, el) => $(el).text().trim()).get(),
                    attributes: [],
                });
            });

        } catch (error) {
            console.error(`An error occurred on page ${pageNum}:`, error.message);

            // *** SAVE ERROR SCREENSHOT WITH TIMESTAMP ***
            const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
            const errorScreenshotPath = path.join(errorsDir, `error_page_${pageNum}_${timestamp}.png`);
            await page.screenshot({ path: errorScreenshotPath });
            console.log(`Error screenshot saved to: ${errorScreenshotPath}`);
        }
    }

    await browser.close();
    console.log('\n--- Browser closed ---');

    console.log('\n--- Final Scraped Data ---');
    console.log(JSON.stringify(allCars, null, 2));
    console.log(`
Total cars scraped: ${allCars.length}`);
}

scrapeCars();