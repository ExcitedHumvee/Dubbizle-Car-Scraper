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
          createdAt: carInfo.createdAt ? new Date(carInfo.createdAt) : null,
          added: carInfo.added ? new Date(carInfo.added) : null,
        };

        if (existingCar) {
          // Car exists, check for updates
          if (existingCar.price !== carPayload.price || existingCar.mileage !== carPayload.mileage) {
            await prisma.carHistory.create({
              data: {
                listingId: listingId,
                price: carPayload.price,
                mileage: carPayload.mileage,
              },
            });
            await prisma.car.update({
              where: { listingId },
              data: carPayload,
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
              features: {
                create: [
                  ...(badges || []).map(b => ({ feature_type: 'badge', feature_name: b })),
                  ...(extras || []).map(e => ({ feature_type: 'extra', feature_name: e })),
                  ...(technicalFeatures || []).map(t => ({ feature_type: 'technical', feature_name: t }))
                ]
              },
              history: {
                create: {
                    price: carPayload.price,
                    mileage: carPayload.mileage,
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
      console.log(`  - Already present in DB: ${alreadyPresentCars} existing cars`);
    }

    // Refresh CarCache at the end of the script
    const allCars = await prisma.car.findMany();
    await prisma.carCache.upsert({
      where: { id: 1 }, // Assuming a single cache entry
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

main();