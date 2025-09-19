-- CreateTable
CREATE TABLE "Car" (
    "listingId" TEXT NOT NULL PRIMARY KEY,
    "detailPageUrl" TEXT,
    "title" TEXT,
    "price" INTEGER,
    "sellerType" TEXT,
    "isNegotiable" BOOLEAN,
    "thumbnailUrl" TEXT,
    "year" INTEGER,
    "mileage" INTEGER,
    "location" TEXT,
    "interiorColor" TEXT,
    "horsepower" TEXT,
    "exteriorColor" TEXT,
    "doors" TEXT,
    "bodyType" TEXT,
    "seatingCapacity" TEXT,
    "cylinders" TEXT,
    "transmissionType" TEXT,
    "engineCapacity" TEXT,
    "trim" TEXT,
    "warranty" TEXT,
    "fuelType" TEXT,
    "vehicleReference" TEXT,
    "make" TEXT,
    "model" TEXT,
    "motorsTrim" TEXT,
    "createdAt" DATETIME,
    "isVerifiedUser" BOOLEAN,
    "isPremium" BOOLEAN,
    "neighbourhood" TEXT,
    "added" DATETIME,
    "last_updated" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CarHistory" (
    "history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" TEXT NOT NULL,
    "price" INTEGER,
    "mileage" INTEGER,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Car" ("listingId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarFeature" (
    "feature_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" TEXT NOT NULL,
    "feature_type" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    CONSTRAINT "CarFeature_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Car" ("listingId") ON DELETE RESTRICT ON UPDATE CASCADE
);
