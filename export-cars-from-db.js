const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// write all cars to json file (will be used by front end next step)
const prisma = new PrismaClient();
async function exportAllCars() {
    try {
        console.log('Fetching all cars from the database...');
        const cars = await prisma.car.findMany();

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

        const normalized = cars.map((c) => normalizeValue(c));

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
