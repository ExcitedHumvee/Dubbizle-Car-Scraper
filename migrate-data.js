const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');

  const fieldsToNormalize = [
    { modelName: 'make', field: 'make' },
    { modelName: 'model', field: 'model' },
    { modelName: 'spec', field: 'spec' },
    { modelName: 'bodyType', field: 'bodyType' },
    { modelName: 'transmissionType', field: 'transmissionType' },
    { modelName: 'fuelType', field: 'fuelType' },
    { modelName: 'location', field: 'location' },
    { modelName: 'neighbourhood', field: 'neighbourhood' },
    { modelName: 'sellerType', field: 'sellerType' },
    { modelName: 'trim', field: 'trim' },
    { modelName: 'warranty', field: 'warranty' },
    { modelName: 'motorsTrim', field: 'motorsTrim' },
  ];

  const colorFields = [
      { modelName: 'color', field: 'interiorColor' },
      { modelName: 'color', field: 'exteriorColor' },
  ]

  for (const config of fieldsToNormalize) {
    console.log(`Migrating ${config.field}...`);
    const distinctValues = await prisma.car.findMany({
      select: { [config.field]: true },
      distinct: [config.field],
    });

    for (const item of distinctValues) {
      const value = item[config.field];
      if (value) {
        const created = await prisma[config.modelName].create({
          data: { name: value },
        });
        await prisma.car.updateMany({
          where: { [config.field]: value },
          data: { [config.field + 'Id']: created.id },
        });
      }
    }
  }

  for (const config of colorFields) {
    console.log(`Migrating ${config.field}...`);
    const distinctValues = await prisma.car.findMany({
        select: { [config.field]: true },
        distinct: [config.field],
    });

    for (const item of distinctValues) {
        const value = item[config.field];
        if (value) {
            let colorRecord = await prisma.color.findUnique({ where: { name: value } });
            if (!colorRecord) {
                colorRecord = await prisma.color.create({ data: { name: value } });
            }
            await prisma.car.updateMany({
                where: { [config.field]: value },
                data: { [config.field + 'Id']: colorRecord.id },
            });
        }
    }
  }


  console.log('Data migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
