SELECT c.spec, COUNT(c.spec) AS spec_count
FROM Car AS c
WHERE c.spec IS NOT NULL
GROUP BY c.spec;

SELECT COUNT(*) FROM Car AS c WHERE c.spec IS NOT NULL;

-- cars and count of history, and also price history
SELECT
  c.listingId,
  c.make,
  c.model,
  c.price,
  c.mileage,
  c.spec,
  GROUP_CONCAT(ch.price) AS history_price,
  c.detailPageUrl,
  COUNT(ch.listingId) AS history_count,
  GROUP_CONCAT(ch.mileage) AS history_mileage
FROM
  Car AS c
LEFT JOIN
  CarHistory AS ch ON c.listingId = ch.listingId
GROUP BY
  c.listingId
ORDER BY
  history_count DESC;