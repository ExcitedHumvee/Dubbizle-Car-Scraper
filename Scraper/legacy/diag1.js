// Diagnostic: what actually happens when we load the Dubizzle used-cars page?
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const URL = 'https://uae.dubizzle.com/motors/used-cars/?sorting=date_desc';

(async () => {
    const headless = process.env.HEADLESS === '1';
    const useProfile = process.env.PROFILE !== '0';
    const useSystemChrome = process.env.SYSTEM_CHROME !== '0';

    console.log(`headless=${headless} profile=${useProfile} systemChrome=${useSystemChrome}`);

    const launchOpts = {
        headless,
        channel: useSystemChrome ? 'chrome' : undefined,
        args: ['--disable-blink-features=AutomationControlled'],
    };
    let context;
    let browser;
    if (useProfile) {
        context = await chromium.launchPersistentContext(
            path.join(OUT, 'profile'),
            { ...launchOpts, viewport: { width: 1440, height: 900 } }
        );
        browser = context.browser();
    } else {
        browser = await chromium.launch(launchOpts);
        context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    }

    const page = context.pages()[0] || await context.newPage();

    const interesting = [];
    page.on('response', async (res) => {
        const u = res.url();
        if (/algolia|search|graphql|api|listing|motors/i.test(u)) {
            interesting.push({ status: res.status(), url: u.slice(0, 300), ct: res.headers()['content-type'] || '' });
        }
    });
    page.on('requestfailed', (req) => {
        console.log('REQ FAILED', req.url().slice(0, 200), req.failure()?.errorText);
    });
    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text().slice(0, 300));
    });

    try {
        const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        console.log('status:', resp && resp.status());
        console.log('title:', await page.title());

        // wait for either listing cards or a captcha
        try {
            await page.waitForSelector('a[data-testid^="listing-"], iframe[src*="captcha"], #captcha, [class*="captcha"]', { timeout: 30000 });
        } catch (e) {
            console.log('waitForSelector timeout:', e.message);
        }

        await page.waitForTimeout(5000);

        console.log('title after wait:', await page.title());
        const cardCount = await page.locator('a[data-testid^="listing-"]').count();
        console.log('listing cards:', cardCount);

        const bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 800);
        console.log('--- body text head ---\n' + bodyText + '\n--- end ---');

        const hasNextData = await page.evaluate(() => !!document.getElementById('__NEXT_DATA__'));
        console.log('__NEXT_DATA__ present:', hasNextData);
        if (hasNextData) {
            const shape = await page.evaluate(() => {
                const raw = document.getElementById('__NEXT_DATA__').textContent;
                const j = JSON.parse(raw);
                const pageProps = j?.props?.pageProps || {};
                return {
                    len: raw.length,
                    pagePropsKeys: Object.keys(pageProps),
                    reduxKeys: pageProps.reduxWrapperActionsGIPP ? pageProps.reduxWrapperActionsGIPP.map(a => a.type).slice(0, 40) : null,
                };
            });
            console.log('NEXT_DATA shape:', JSON.stringify(shape, null, 2));
        }

        const frames = page.frames().map(f => f.url()).filter(Boolean);
        console.log('frames:', JSON.stringify(frames, null, 2));

        const html = await page.content();
        fs.writeFileSync(path.join(OUT, 'page.html'), html);
        await page.screenshot({ path: path.join(OUT, 'page.png'), fullPage: false });
        console.log('saved page.html', html.length, 'bytes');

        console.log('--- network (filtered) ---');
        for (const r of interesting.slice(0, 80)) console.log(r.status, r.ct.slice(0, 40), r.url);
    } catch (err) {
        console.error('FATAL:', err.message);
    } finally {
        await context.close();
        if (browser && browser !== context.browser()) await browser.close().catch(() => {});
    }
})();
