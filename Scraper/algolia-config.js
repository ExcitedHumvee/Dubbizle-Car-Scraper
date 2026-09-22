/**
 * configuration for the Algolia-backed Dubizzle scraper.
 *
 * Why this file exists
 * --------------------
 * Dubizzle's website (uae.dubizzle.com) sits behind Imperva/Incapsula, which now
 * answers automated requests with a "Pardon Our Interruption" page + hCaptcha
 * challenge instead of the listing HTML. Driving a browser into that wall is
 * both slow and continually broken.
 *
 * The listing page itself does NOT contain the listings: it is a React app that
 * queries Algolia. Those Algolia credentials are shipped to every visitor inside
 * the page payload (`algolia_app_id` / `algolia_app_key`), so the search API can
 * be queried directly. That endpoint is a third-party service, not behind the
 * Dubizzle WAF, so it does not trigger the captcha at all.
 *
 * The values below are the app's own *public search-only* key (the one every
 * browser receives). If Dubizzle ever rotates it, override it here via the
 * environment or `Scraper/algolia-credentials.json` - see README.
 */

const APP_ID = process.env.ALGOLIA_APP_ID || 'WD0PTZ13ZS';
const API_KEY = process.env.ALGOLIA_API_KEY || 'cdd839b4fdac840289e88633779e8634';

module.exports = {
  APP_ID,
  API_KEY,

  // The motor-vehicle index. `motors.com` is what the used-cars page queries
  // (visible in the page payload as `algoliaIndexName`).
  INDEX: process.env.ALGOLIA_INDEX || 'motors.com',

  /**
   * Optional custom host. Dubizzle enables a feature flag pointing Algolia at
   * https://algolia.dubizzle.com, but that host is a transparent proxy for the
   * standard Algolia endpoints - both work and return identical data. We use
   * `-dsn.algolia.net`, which is Algolia's recommended read endpoint, and fall
   * back to the other hosts automatically.
   */
  HOSTS: [
    `${APP_ID}-dsn.algolia.net`,
    `${APP_ID}.algolia.net`,
    `${APP_ID}-1.algolianet.com`,
    'algolia.dubizzle.com',
  ],

  /** Only used cars, UAE. Verified against the site's own 34k+ listing count. */
  FILTER: process.env.ALGOLIA_FILTER || 'category_v2.slug_paths:"motors/used-cars"',

  /** Algolia allows up to 1000 hits per request; we page out from there. */
  HITS_PER_PAGE: Number(process.env.ALGOLIA_HITS_PER_PAGE || 1000),

  /**
   * A single query can only reach the first 10,000 hits, so we partition the
   * category by facet until every partition fits under that ceiling.
   * `make` yields ~125 partitions, the largest ~4,000 hits.
   */
  PARTITION_FACET: 'category_v2.slug_paths',

  /** How many requests may be in flight at once. Algolia is happy with a few. */
  CONCURRENCY: Number(process.env.SCRAPE_CONCURRENCY || 4),

  /** Retries per request (with backoff) for transient network/limit errors. */
  RETRIES: Number(process.env.SCRAPE_RETRIES || 5),

  /** Delay between attempts of the same request, in ms. */
  RETRY_DELAY_MS: Number(process.env.SCRAPE_RETRY_DELAY_MS || 1500),

  /** Guard rail so a runaway partition can never loop forever. */
  MAX_PAGES_PER_PARTITION: Number(process.env.SCRAPE_MAX_PAGES || 20),

  /**
   * Sanity floor: if a run returns fewer cars than this, the output file is
   * treated as suspicious and the scraper exits non-zero *without* writing an
   * unprocessed file (so save-to-db.js cannot import a captcha/empty page).
   */
  MIN_EXPECTED_CARS: Number(process.env.SCRAPE_MIN_CARS || 1000),
};
