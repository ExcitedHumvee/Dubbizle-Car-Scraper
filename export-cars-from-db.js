const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Write every car to json (used by the front-end build step next).
//
// There is deliberately no row cap here. index.html used to be limited to 70,000
// cars because the data was embedded as raw JSON and hit GitHub Pages' 100 MB
// file limit. update-index-html-with-new-cars.js now gzip-compresses the payload
// (~117 MB -> ~21 MB), so the whole table can be exported and published.
const prisma = new PrismaClient();
async function exportAllCars() {
    try {
        console.log('Fetching all cars from the database...');
        const cars = await prisma.car.findMany({
            orderBy: {
                last_updated: 'desc'
            }
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

        const normalized = cars.map((c) => normalizeValue(c));

        const out = { Car: normalized };

        const outPath = path.join(__dirname, 'all-cars-from-db.json');
        fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
        console.log(`Wrote ${normalized.length} cars to ${outPath}`);
    } catch (err) {
        console.error('Failed to export cars:', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

exportAllCars();
