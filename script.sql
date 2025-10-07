-- spec counts
SELECT c.spec, COUNT(*) AS spec_count
FROM Car_details AS c
GROUP BY c.spec;

-- cars and count of history, and also price history, also price history difference
SELECT
  c.listingId,
  c.make,
  c.model,
  c.price,
  c.mileage,
  c.spec,
  GROUP_CONCAT(ch.price) AS history_price,
  MAX(ch.price) - MIN(ch.price) AS price_difference,
  c.detailPageUrl,
  COUNT(ch.listingId) AS history_count,
  GROUP_CONCAT(ch.mileage) AS history_mileage
FROM
  Car_details  AS c
LEFT JOIN
  CarHistory AS ch ON c.listingId = ch.listingId
GROUP BY
  c.listingId
HAVING
  COUNT(ch.listingId) >= 2
ORDER BY
  history_count DESC;

--All models with their counts
SELECT
  c.model,
  COUNT(*) AS model_count
FROM
  Car_details AS c
GROUP BY
  c.model
ORDER BY
  model_count DESC;

-- Makes with the count of models for each make
SELECT
  c.make,
  COUNT(DISTINCT c.model) AS model_count
FROM
  Car_details AS c
GROUP BY
  c.make
ORDER BY
  model_count DESC;

-- List all tables
SELECT name
FROM sqlite_master
WHERE type='table'
AND name NOT LIKE 'sqlite_%';

PRAGMA page_size;

-- Find byte size of each table (working)
ANALYZE;
WITH TableStats AS (
    SELECT
        m.name AS table_name,
        -- Attempt to extract the first number from the 'stat' string, which is the page count
        CAST(
            CASE
                -- If stat has a space, extract the integer before it
                WHEN INSTR(s.stat, ' ') > 0
                THEN SUBSTR(s.stat, 1, INSTR(s.stat, ' ') - 1)
                -- Otherwise, assume the entire string is the page count
                ELSE s.stat
            END
        AS INTEGER) AS page_count_from_stat
    FROM
        sqlite_master AS m
    LEFT JOIN
        sqlite_stat1 AS s ON m.name = s.tbl AND s.idx IS NULL
    WHERE
        m.type = 'table'
        AND m.name NOT LIKE 'sqlite_%'
)
SELECT
    table_name,
    -- Default page count to 0 if NULL (table is empty/un-analyzed)
    IFNULL(page_count_from_stat, 0) AS total_pages,
    -- Get the global page size
    (SELECT page_size FROM pragma_page_size()) AS page_size_bytes,
    -- Calculate Size in MB
    ROUND(
        (IFNULL(page_count_from_stat, 0) * (SELECT page_size FROM pragma_page_size()) / 1024.0 / 1024.0),
        3
    ) AS size_mb
FROM
    TableStats
ORDER BY
    size_mb DESC;

-- Step 1: Delete from tables with foreign keys to the 'Car' table
DELETE FROM CarFeature;
DELETE FROM CarHistory;

-- Step 2: Delete from the main 'Car' table
DELETE FROM Car;

-- Step 3: Delete from all the lookup/dimension tables
DELETE FROM Make;
DELETE FROM Model;
DELETE FROM Spec;
DELETE FROM BodyType;
DELETE FROM TransmissionType;
DELETE FROM FuelType;
DELETE FROM Location;
DELETE FROM Neighbourhood;
DELETE FROM Color;
DELETE FROM SellerType;
DELETE FROM Trim;
DELETE FROM Warranty;
DELETE FROM MotorsTrim;
DELETE FROM EngineCapacity;
DELETE FROM Horsepower;
DELETE FROM Doors;
DELETE FROM SeatingCapacity;

-- Step 4: Delete from remaining utility tables
DELETE FROM CarCache;


