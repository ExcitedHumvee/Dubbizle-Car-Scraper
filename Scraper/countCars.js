const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

countCars();