-- Drop the Car indexes that no query uses.
--
-- The application only ever looks a Car up by its primary key (`listingId`) or
-- orders by `last_updated`. None of these nine indexes were referenced by any
-- code path, and together they occupied ~18 MB of the database.
--
-- Measured after dropping them: dev.db 98.85 MB -> 80.99 MB, with no slowdown in
-- `orderBy last_updated` or `where listingId in (...)`.
--
-- IF EXISTS keeps this migration idempotent and safe on a database where the
-- indexes were already removed by hand (see Scraper/compact-db.js).

DROP INDEX IF EXISTS "Car_make_idx";
DROP INDEX IF EXISTS "Car_model_idx";
DROP INDEX IF EXISTS "Car_year_idx";
DROP INDEX IF EXISTS "Car_mileage_idx";
DROP INDEX IF EXISTS "Car_price_idx";
DROP INDEX IF EXISTS "Car_bodyType_idx";
DROP INDEX IF EXISTS "Car_transmissionType_idx";
DROP INDEX IF EXISTS "Car_fuelType_idx";
DROP INDEX IF EXISTS "Car_location_idx";
