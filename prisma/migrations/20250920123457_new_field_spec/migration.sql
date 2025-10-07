-- CreateTable
CREATE TABLE "Car" (
    "listingId" TEXT NOT NULL PRIMARY KEY,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "mileage" INTEGER,
    "price" INTEGER,
    "title" TEXT,
    "isPremium" BOOLEAN,
    "bodyType" TEXT,
    "engineCapacity" TEXT,
    "horsepower" TEXT,
    "transmissionType" TEXT,
    "cylinders" TEXT,
    "interiorColor" TEXT,
    "exteriorColor" TEXT,
    "doors" TEXT,
    "seatingCapacity" TEXT,
    "trim" TEXT,
    "warranty" TEXT,
    "fuelType" TEXT,
    "motorsTrim" TEXT,
    "spec" TEXT,
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

-- CreateTable
CREATE TABLE "CarHistory" (
    "history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" TEXT,
    "price" INTEGER,
    "mileage" INTEGER,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Car" ("listingId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarFeature" (
    "feature_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" TEXT NOT NULL,
    "feature_type" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    CONSTRAINT "CarFeature_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Car" ("listingId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Car_make_idx" ON "Car"("make");

-- CreateIndex
CREATE INDEX "Car_model_idx" ON "Car"("model");

-- CreateIndex
CREATE INDEX "Car_year_idx" ON "Car"("year");

-- CreateIndex
CREATE INDEX "Car_mileage_idx" ON "Car"("mileage");

-- CreateIndex
CREATE INDEX "Car_price_idx" ON "Car"("price");

-- CreateIndex
CREATE INDEX "Car_bodyType_idx" ON "Car"("bodyType");

-- CreateIndex
CREATE INDEX "Car_transmissionType_idx" ON "Car"("transmissionType");

-- CreateIndex
CREATE INDEX "Car_fuelType_idx" ON "Car"("fuelType");

-- CreateIndex
CREATE INDEX "Car_location_idx" ON "Car"("location");
