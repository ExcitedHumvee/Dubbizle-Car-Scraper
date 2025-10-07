-- spec counts
SELECT c.spec, COUNT(*) AS spec_count
FROM Car AS c
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
  Car AS c
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
  Car AS c
GROUP BY
  c.model
ORDER BY
  model_count DESC;

-- Makes with the count of models for each make
SELECT
  c.make,
  COUNT(DISTINCT c.model) AS model_count
FROM
  Car AS c
GROUP BY
  c.make
ORDER BY
  model_count DESC;



