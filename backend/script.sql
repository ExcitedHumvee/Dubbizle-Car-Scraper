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