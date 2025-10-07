const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// write all cars to json file (will be used by front end next step)
const prisma = new PrismaClient();
async function exportAllCars() {
    try {
        console.log('Fetching all cars from the database...');
        const cars = await prisma.car.findMany({
            include: {
                make: true,
                model: true,
                spec: true,
                bodyType: true,
                transmissionType: true,
                fuelType: true,
                location: true,
                neighbourhood: true,
                interiorColor: true,
                exteriorColor: true,
                sellerType: true,
                trim: true,
                warranty: true,
                motorsTrim: true,
                engineCapacity: true,
                horsepower: true,
                doors: true,
                seatingCapacity: true,
            }
        });

        const flattenedCars = cars.map(car => {
            const flatCar = { ...car };
            const fieldsToFlatten = [
                { rel: 'make', field: 'make' },
                { rel: 'model', field: 'model' },
                { rel: 'spec', field: 'spec' },
                { rel: 'bodyType', field: 'bodyType' },
                { rel: 'transmissionType', field: 'transmissionType' },
                { rel: 'fuelType', field: 'fuelType' },
                { rel: 'location', field: 'location' },
                { rel: 'neighbourhood', field: 'neighbourhood' },
                { rel: 'interiorColor', field: 'interiorColor' },
                { rel: 'exteriorColor', field: 'exteriorColor' },
                { rel: 'sellerType', field: 'sellerType' },
                { rel: 'trim', field: 'trim' },
                { rel: 'warranty', field: 'warranty' },
                { rel: 'motorsTrim', field: 'motorsTrim' },
            ];

            for (const { rel, field } of fieldsToFlatten) {
                if (flatCar[rel]) {
                    flatCar[field] = flatCar[rel].name;
                }
                delete flatCar[rel];
            }

            // Flatten new normalized fields
            if (flatCar.engineCapacity) {
                flatCar.engineCapacity = flatCar.engineCapacity.value;
            }
            if (flatCar.horsepower) {
                flatCar.horsepower = flatCar.horsepower.value;
            }
            if (flatCar.doors) {
                flatCar.doors = flatCar.doors.value;
            }
            if (flatCar.seatingCapacity) {
                flatCar.seatingCapacity = flatCar.seatingCapacity.value;
            }
            
            // also delete the id fields
            delete flatCar.makeId;
            delete flatCar.modelId;
            delete flatCar.specId;
            delete flatCar.bodyTypeId;
            delete flatCar.transmissionTypeId;
            delete flatCar.fuelTypeId;
            delete flatCar.locationId;
            delete flatCar.neighbourhoodId;
            delete flatCar.interiorColorId;
            delete flatCar.exteriorColorId;
            delete flatCar.sellerTypeId;
            delete flatCar.trimId;
            delete flatCar.warrantyId;
            delete flatCar.motorsTrimId;
            delete flatCar.engineCapacityId;
            delete flatCar.horsepowerId;
            delete flatCar.doorsId;
            delete flatCar.seatingCapacityId;

            return flatCar;
        });


        // Normalize values: Date -> epoch ms, boolean -> 1/0, recursively for arrays/objects
        function normalizeValue(val) {
            if (val === null || val === undefined) return val;
            if (val instanceof Date) return val.getTime();
            if (Array.isArray(val)) return val.map(normalizeValue);
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (typeof val === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(val)) {
                    out[k] = normalizeValue(v);
                }
                return out;
            }
            return val;
        }

        const normalized = flattenedCars.map((c) => normalizeValue(c));

        const out = { Car: normalized };

        const outPath = path.join(__dirname, 'all-cars-from-db.json');
        fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
        console.log(`Wrote ${normalized.length} cars to ${outPath}`);
    } catch (err) {
        console.error('Failed to export cars:', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

exportAllCars();