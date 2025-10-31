const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
    let browser;
    try {
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: false
        });
        const page = await browser.newPage();

        // Set a reasonable default timeout for all actions.
        page.setDefaultTimeout(20000); // 20 seconds

        console.log('Navigating to Dubizzle Motors...');
        await page.goto('https://uae.dubizzle.com/motors/used-cars/');

        console.log('Checking for cookie banner...');
        try {
            // Click the cookie banner if it appears. Use a short timeout.
            await page.getByRole('button', { name: 'Accept All' }).click({ timeout: 5000 });
            console.log('Cookie banner accepted.');
        } catch (error) {
            console.log('Cookie banner not found or already accepted.');
        }

        // --- THE KEY CHANGE ---
        // Instead of waiting for the network or a container, we wait for the
        // very first car listing to become visible. This is the most reliable indicator.
        console.log('Waiting for the first car listing to appear...');
        await page.locator('a[data-testid^="listing-"]').first().waitFor();
        console.log('Listings are visible. Page is ready.');

        // --- The rest of the script continues as before ---

        console.log('Clicking on the Sort button...');
        await page.getByTestId('sort-button').click();

        console.log('Selecting "Newest to Oldest" sort option...');
        await page.getByRole('listitem').filter({ hasText: 'Newest to Oldest' }).click();
        await page.waitForURL('**/motors/used-cars/?sorting=date_desc**');
        console.log('Sorting has been applied.');

        console.log('Navigating to Page 2...');
        await page.getByTestId('page-2').click();
        await page.waitForURL('**/motors/used-cars/?sorting=date_desc&page=2**');
        console.log('On Page 2.');

        console.log('Navigating to Page 3...');
        await page.getByTestId('page-3').click();
        await page.waitForURL('**/motors/used-cars/?sorting=date_desc&page=3**');
        await page.locator('a[data-testid^="listing-"]').first().waitFor(); // Wait for listings on page 3
        console.log('On Page 3.');

        console.log('\n--- Scraping Car Data from Page 3 ---');
        const carListingLocators = await page.locator('a[data-testid^="listing-"]').all();
        console.log(`Found ${carListingLocators.length} car listings.`);

        const allCarsFound = [];
        for (const listingLocator of carListingLocators) {
            try {
                const titleParts = await listingLocator.locator('[data-testid^="heading-text-"]').allTextContents();
                const price = await listingLocator.locator('[data-testid="listing-price"]').textContent();
                const year = await listingLocator.locator('[data-testid="listing-year"]').textContent();
                const kms = await listingLocator.locator('[data-testid="listing-kms"]').textContent();
                const location = await listingLocator.locator('.mui-style-t0mppt').textContent();

                allCarsFound.push({
                    title: titleParts.join(' ').trim(), price: price.trim(), year: year.trim(), mileage: kms.trim(), location: location.trim(),
                });
            } catch (error) {
                console.log("Could not extract details for one listing, skipping.");
            }
        }

        console.log('\n--- Results ---');
        console.log(JSON.stringify(allCarsFound, null, 2));

        await browser.close();
        console.log('Browser closed successfully.');

    } catch (error) {
        console.error('An error occurred during scraping:', error.message);
        console.log("\nBrowser might remain open for debugging. Manually close it if needed.");
        // We ensure browser is closed in a final 'finally' block to prevent zombie processes.
        if (browser) {
            await browser.close();
        }
    }
}

main();