/*
  Warnings:

  - You are about to alter the column `cylinders` on the `Car` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Car" (
    "listingId" TEXT NOT NULL PRIMARY KEY,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "mileage" INTEGER,
    "price" INTEGER,
    "title" TEXT,
    "spec" TEXT,
    "isPremium" BOOLEAN,
    "bodyType" TEXT,
    "engineCapacity" TEXT,
    "horsepower" TEXT,
    "transmissionType" TEXT,
    "cylinders" INTEGER,
    "interiorColor" TEXT,
    "exteriorColor" TEXT,
    "doors" TEXT,
    "seatingCapacity" TEXT,
    "trim" TEXT,
    "warranty" TEXT,
    "fuelType" TEXT,
    "motorsTrim" TEXT,
    "sellerType" TEXT,
    "location" TEXT,
    "neighbourhood" TEXT,
    "detailPageUrl" TEXT,
    "isNegotiable" BOOLEAN,
    "thumbnailUrl" TEXT,
    "vehicleReference" TEXT,
    "isVerifiedUser" BOOLEAN,
    "createdAt" DATETIME,
    "added" DATETIME,
    "last_updated" DATETIME NOT NULL
);
INSERT INTO "new_Car" ("added", "bodyType", "createdAt", "cylinders", "detailPageUrl", "doors", "engineCapacity", "exteriorColor", "fuelType", "horsepower", "interiorColor", "isNegotiable", "isPremium", "isVerifiedUser", "last_updated", "listingId", "location", "make", "mileage", "model", "motorsTrim", "neighbourhood", "price", "seatingCapacity", "sellerType", "spec", "thumbnailUrl", "title", "transmissionType", "trim", "vehicleReference", "warranty", "year") SELECT "added", "bodyType", "createdAt", "cylinders", "detailPageUrl", "doors", "engineCapacity", "exteriorColor", "fuelType", "horsepower", "interiorColor", "isNegotiable", "isPremium", "isVerifiedUser", "last_updated", "listingId", "location", "make", "mileage", "model", "motorsTrim", "neighbourhood", "price", "seatingCapacity", "sellerType", "spec", "thumbnailUrl", "title", "transmissionType", "trim", "vehicleReference", "warranty", "year" FROM "Car";
DROP TABLE "Car";
ALTER TABLE "new_Car" RENAME TO "Car";
CREATE INDEX "Car_make_idx" ON "Car"("make");
CREATE INDEX "Car_model_idx" ON "Car"("model");
CREATE INDEX "Car_year_idx" ON "Car"("year");
CREATE INDEX "Car_mileage_idx" ON "Car"("mileage");
CREATE INDEX "Car_price_idx" ON "Car"("price");
CREATE INDEX "Car_bodyType_idx" ON "Car"("bodyType");
CREATE INDEX "Car_transmissionType_idx" ON "Car"("transmissionType");
CREATE INDEX "Car_fuelType_idx" ON "Car"("fuelType");
CREATE INDEX "Car_location_idx" ON "Car"("location");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
