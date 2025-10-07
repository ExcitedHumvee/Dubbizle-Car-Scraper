/*
  Warnings:
  - Dropping a column is only supported in SQLite version 3.35.0 and newer.
  - The data in these columns should be migrated to the new relational tables before running this script.
*/

-- Drop old indexes
DROP INDEX IF EXISTS "Car_make_idx";
DROP INDEX IF EXISTS "Car_model_idx";
DROP INDEX IF EXISTS "Car_bodyType_idx";
DROP INDEX IF EXISTS "Car_transmissionType_idx";
DROP INDEX IF EXISTS "Car_fuelType_idx";
DROP INDEX IF EXISTS "Car_location_idx";

-- Drop old string columns from the Car table
ALTER TABLE "Car" DROP COLUMN "make";
ALTER TABLE "Car" DROP COLUMN "model";
ALTER TABLE "Car" DROP COLUMN "spec";
ALTER TABLE "Car" DROP COLUMN "bodyType";
ALTER TABLE "Car" DROP COLUMN "transmissionType";
ALTER TABLE "Car" DROP COLUMN "fuelType";
ALTER TABLE "Car" DROP COLUMN "location";
ALTER TABLE "Car" DROP COLUMN "neighbourhood";
ALTER TABLE "Car" DROP COLUMN "interiorColor";
ALTER TABLE "Car" DROP COLUMN "exteriorColor";
ALTER TABLE "Car" DROP COLUMN "sellerType";
ALTER TABLE "Car" DROP COLUMN "trim";
ALTER TABLE "Car" DROP COLUMN "warranty";
ALTER TABLE "Car" DROP COLUMN "motorsTrim";
ALTER TABLE "Car" DROP COLUMN "engineCapacity";
ALTER TABLE "Car" DROP COLUMN "horsepower";
ALTER TABLE "Car" DROP COLUMN "doors";
ALTER TABLE "Car" DROP COLUMN "seatingCapacity";

-- Reclaim unused space
VACUUM;