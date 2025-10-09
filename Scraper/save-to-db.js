require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const unprocessedDir = path.join(__dirname, 'unprocessed');
  const processedDir = path.join(__dirname, 'processed');

  try {
    await fs.mkdir(processedDir, { recursive: true });
    const files = (await fs.readdir(unprocessedDir))
      .filter(file => path.extname(file) === '.json')
      .sort((a, b) => {
        const timestampA = new Date(a.split('T')[0]);
        const timestampB = new Date(b.split('T')[0]);
        return timestampA.getTime() - timestampB.getTime();
      });

    for (const file of files) {
      const name = file.split('.')[0];
      const parts = name.split('T');
      const timeParts = parts[1].split('-');
      const isoStr = `${parts[0]}T${timeParts.slice(0, 3).join(':')}.${timeParts[3]}Z`;
      const fileTimestamp = new Date(isoStr);


      const filePath = path.join(unprocessedDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const cars = JSON.parse(fileContent);
      const totalCars = cars.length;

      console.log(`\nProcessing ${file}, found ${totalCars} records.`);

      let newCars = 0;
      let updatedCars = 0;
      let alreadyPresentCars = 0;
      let processedCount = 0;

      for (const carData of cars) {
        processedCount++;
        const { listingId, badges, extras, technicalFeatures, ...carInfo } = carData;

        if (!listingId) continue;

        const existingCar = await prisma.car.findUnique({
          where: { listingId },
        });

        const carPayload = {
          ...carInfo,
          listingId,
          price: carInfo.price ? parseInt(carInfo.price) : null,
          mileage: carInfo.mileage ? parseInt(carInfo.mileage) : null,
          year: carInfo.year ? parseInt(carInfo.year) : null,
          cylinders: carInfo.cylinders ? parseInt(carInfo.cylinders) : null,
          createdAt: carInfo.createdAt ? new Date(carInfo.createdAt) : null,
          added: carInfo.added ? new Date(carInfo.added) : null,
        };

        if (existingCar) {
          // Car exists, check for updates
          const dataToUpdate = {};
          let hasChanges = false;

          for (const key in carPayload) {
            const incomingValue = carPayload[key];
            const existingValue = existingCar[key];

            // Only include if incoming value is not null or undefined
            if (incomingValue !== null && incomingValue !== undefined) {
              // If existing value is null/undefined OR incoming value is different, then it's a change
              if (existingValue === null || existingValue === undefined || incomingValue !== existingValue) {
                dataToUpdate[key] = incomingValue;
                // Special handling for Date objects to compare their string representation
              if (incomingValue instanceof Date && existingValue instanceof Date) {
                if (incomingValue.toISOString() !== existingValue.toISOString()) {
                  hasChanges = true;
                }
              } else if (incomingValue !== existingValue) {
                hasChanges = true;
                }
              }
            }
          }

          // Ensure listingId is not updated as it's the primary key
          delete dataToUpdate.listingId;

          if (Object.keys(dataToUpdate).length > 0 && hasChanges) {
            dataToUpdate.last_updated = fileTimestamp;
            // Check if price or mileage specifically changed for history
            const priceChanged = dataToUpdate.price !== undefined && existingCar.price !== dataToUpdate.price;
            const mileageChanged = dataToUpdate.mileage !== undefined && existingCar.mileage !== dataToUpdate.mileage;

            if (priceChanged || mileageChanged) {
              await prisma.carHistory.create({
                data: {
                  listingId: listingId,
                  price: dataToUpdate.price !== undefined ? dataToUpdate.price : existingCar.price,
                  mileage: dataToUpdate.mileage !== undefined ? dataToUpdate.mileage : existingCar.mileage,
                  changed_at: fileTimestamp,
                },
              });
            }

            await prisma.car.update({
              where: { listingId },
              data: dataToUpdate,
            });
            updatedCars++;
          } else {
            alreadyPresentCars++;
          }
        } else {
          // New car, create it
          await prisma.car.create({
            data: {
              ...carPayload,
              last_updated: fileTimestamp,
              // --- MODIFICATION START ---
              // The 'features' relation has been removed as per the new schema.
              // The related CarFeature records for badges, extras, and technicalFeatures
              // will no longer be created.
              // --- MODIFICATION END ---
              history: {
                create: {
                  price: carPayload.price,
                  mileage: carPayload.mileage,
                  changed_at: fileTimestamp,
                }
              }
            },
          });
          newCars++;
        }

        if (processedCount % 500 === 0) {
          console.log(`  ... processed ${processedCount} of ${totalCars} cars. Remaining: ${totalCars - processedCount}`);
        }
      }

      // Move the file to the processed directory
      const newFilePath = path.join(processedDir, file);
      await fs.rename(filePath, newFilePath);

      console.log(`Finished processing ${file}:`);
      console.log(`  - Added: ${newCars} new cars`);
      console.log(`  - Updated: ${updatedCars} existing cars`);
      console.log(`  - No changes: ${alreadyPresentCars} cars`);
    }

    // Refresh CarCache at the end of the script
    console.log('\nRefreshing CarCache...');
    const allCars = await prisma.car.findMany();
    await prisma.carCache.upsert({
      where: { id: 1 }, // Assuming a single cache entry with id 1
      update: { data: JSON.stringify(allCars) },
      create: { data: JSON.stringify(allCars) },
    });
    console.log('CarCache refreshed successfully.');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function countCars() {
  try {
    const carCount = await prisma.car.count();
    console.log(`Total cars in the database: ${carCount}`);
  } catch (error) {
    console.error('Error counting cars:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
countCars();