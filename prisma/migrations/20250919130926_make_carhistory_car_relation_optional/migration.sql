-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CarHistory" (
    "history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" TEXT,
    "price" INTEGER,
    "mileage" INTEGER,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Car" ("listingId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CarHistory" ("changed_at", "history_id", "listingId", "mileage", "price") SELECT "changed_at", "history_id", "listingId", "mileage", "price" FROM "CarHistory";
DROP TABLE "CarHistory";
ALTER TABLE "new_CarHistory" RENAME TO "CarHistory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
