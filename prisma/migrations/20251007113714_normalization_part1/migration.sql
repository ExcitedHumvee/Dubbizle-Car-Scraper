-- CreateTable
CREATE TABLE "Make" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Spec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BodyType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TransmissionType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FuelType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Neighbourhood" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Color" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SellerType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Trim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MotorsTrim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

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
    "last_updated" DATETIME NOT NULL,
    "makeId" INTEGER,
    "modelId" INTEGER,
    "specId" INTEGER,
    "bodyTypeId" INTEGER,
    "transmissionTypeId" INTEGER,
    "fuelTypeId" INTEGER,
    "locationId" INTEGER,
    "neighbourhoodId" INTEGER,
    "interiorColorId" INTEGER,
    "exteriorColorId" INTEGER,
    "sellerTypeId" INTEGER,
    "trimId" INTEGER,
    "warrantyId" INTEGER,
    "motorsTrimId" INTEGER,
    CONSTRAINT "Car_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "Make" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_specId_fkey" FOREIGN KEY ("specId") REFERENCES "Spec" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_bodyTypeId_fkey" FOREIGN KEY ("bodyTypeId") REFERENCES "BodyType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_transmissionTypeId_fkey" FOREIGN KEY ("transmissionTypeId") REFERENCES "TransmissionType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "FuelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "Neighbourhood" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_interiorColorId_fkey" FOREIGN KEY ("interiorColorId") REFERENCES "Color" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_exteriorColorId_fkey" FOREIGN KEY ("exteriorColorId") REFERENCES "Color" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_sellerTypeId_fkey" FOREIGN KEY ("sellerTypeId") REFERENCES "SellerType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_trimId_fkey" FOREIGN KEY ("trimId") REFERENCES "Trim" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Car_motorsTrimId_fkey" FOREIGN KEY ("motorsTrimId") REFERENCES "MotorsTrim" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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

-- CreateIndex
CREATE UNIQUE INDEX "Make_name_key" ON "Make"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Model_name_key" ON "Model"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Spec_name_key" ON "Spec"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BodyType_name_key" ON "BodyType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TransmissionType_name_key" ON "TransmissionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FuelType_name_key" ON "FuelType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Neighbourhood_name_key" ON "Neighbourhood"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Color_name_key" ON "Color"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SellerType_name_key" ON "SellerType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Trim_name_key" ON "Trim"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_name_key" ON "Warranty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MotorsTrim_name_key" ON "MotorsTrim"("name");
