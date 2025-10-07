CREATE VIEW Car_details AS
SELECT
  c.listingId,
  c.year,
  c.mileage,
  c.price,
  c.title,
  c.isPremium,
  c.engineCapacity,
  c.horsepower,
  c.cylinders,
  c.doors,
  c.seatingCapacity,
  c.detailPageUrl,
  c.isNegotiable,
  c.thumbnailUrl,
  c.vehicleReference,
  c.isVerifiedUser,
  c.createdAt,
  c.added,
  c.last_updated,
  make.name AS make,
  model.name AS model,
  spec.name AS spec,
  bodyType.name AS bodyType,
  transmissionType.name AS transmissionType,
  fuelType.name AS fuelType,
  location.name AS location,
  neighbourhood.name AS neighbourhood,
  interiorColor.name AS interiorColor,
  exteriorColor.name AS exteriorColor,
  sellerType.name AS sellerType,
  trim.name AS trim,
  warranty.name AS warranty,
  motorsTrim.name AS motorsTrim
FROM
  Car AS c
LEFT JOIN Make AS make ON c.makeId = make.id
LEFT JOIN Model AS model ON c.modelId = model.id
LEFT JOIN Spec AS spec ON c.specId = spec.id
LEFT JOIN BodyType AS bodyType ON c.bodyTypeId = bodyType.id
LEFT JOIN TransmissionType AS transmissionType ON c.transmissionTypeId = transmissionType.id
LEFT JOIN FuelType AS fuelType ON c.fuelTypeId = fuelType.id
LEFT JOIN Location AS location ON c.locationId = location.id
LEFT JOIN Neighbourhood AS neighbourhood ON c.neighbourhoodId = neighbourhood.id
LEFT JOIN Color AS interiorColor ON c.interiorColorId = interiorColor.id
LEFT JOIN Color AS exteriorColor ON c.exteriorColorId = exteriorColor.id
LEFT JOIN SellerType AS sellerType ON c.sellerTypeId = sellerType.id
LEFT JOIN Trim AS trim ON c.trimId = trim.id
LEFT JOIN Warranty AS warranty ON c.warrantyId = warranty.id
LEFT JOIN MotorsTrim AS motorsTrim ON c.motorsTrimId = motorsTrim.id;
