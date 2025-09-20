require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Swagger definition
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Car Scraper API',
      version: '1.0.0',
      description: 'API for car data from Dubbizle',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./index.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * tags:
 *   name: Cars
 *   description: Car management
 */

/**
 * @swagger
 * /api/cars:
 *   get:
 *     summary: Retrieve a list of cars with optional filtering and pagination
 *     tags: [Cars]
 *     parameters:
 *       - in: query
 *         name: make
 *         schema:
 *           type: string
 *         description: Filter by car make
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by car model
 *       - in: query
 *         name: minYear
 *         schema:
 *           type: integer
 *         description: Filter by minimum manufacturing year
 *       - in: query
 *         name: maxYear
 *         schema:
 *           type: integer
 *         description: Filter by maximum manufacturing year
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Filter by minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Filter by maximum price
 *       - in: query
 *         name: minMileage
 *         schema:
 *           type: number
 *         description: Filter by minimum mileage
 *       - in: query
 *         name: maxMileage
 *         schema:
 *           type: number
 *         description: Filter by maximum mileage
 *       - in: query
 *         name: isPremium
 *         schema:
 *           type: boolean
 *         description: Filter by premium status
 *       - in: query
 *         name: bodyType
 *         schema:
 *           type: string
 *         description: Filter by body type
 *       - in: query
 *         name: engineCapacity
 *         schema:
 *           type: number
 *         description: Filter by engine capacity
 *       - in: query
 *         name: horsepower
 *         schema:
 *           type: number
 *         description: Filter by horsepower
 *       - in: query
 *         name: transmissionType
 *         schema:
 *           type: string
 *         description: Filter by transmission type
 *       - in: query
 *         name: cylinders
 *         schema:
 *           type: integer
 *         description: Filter by number of cylinders
 *       - in: query
 *         name: interiorColor
 *         schema:
 *           type: string
 *         description: Filter by interior color
 *       - in: query
 *         name: exteriorColor
 *         schema:
 *           type: string
 *         description: Filter by exterior color
 *       - in: query
 *         name: doors
 *         schema:
 *           type: integer
 *         description: Filter by number of doors
 *       - in: query
 *         name: seatingCapacity
 *         schema:
 *           type: integer
 *         description: Filter by seating capacity
 *       - in: query
 *         name: trim
 *         schema:
 *           type: string
 *         description: Filter by trim level
 *       - in: query
 *         name: warranty
 *         schema:
 *           type: boolean
 *         description: Filter by warranty availability
 *       - in: query
 *         name: fuelType
 *         schema:
 *           type: string
 *         description: Filter by fuel type
 *       - in: query
 *         name: motorsTrim
 *         schema:
 *           type: string
 *         description: Filter by motors trim
 *       - in: query
 *         name: sellerType
 *         schema:
 *           type: string
 *         description: Filter by seller type
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: neighbourhood
 *         schema:
 *           type: string
 *         description: Filter by neighbourhood
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of items to skip for pagination
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Number of items to take for pagination (default 1000)
 *     responses:
 *       200:
 *         description: A list of cars matching the criteria.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   year:
 *                     type: integer
 *                   price:
 *                     type: number
 */
app.get('/api/cars', async (req, res) => {
  try {
    const { 
      make, model, minYear, maxYear, minPrice, maxPrice, minMileage, maxMileage,
      isPremium, bodyType, engineCapacity, horsepower, transmissionType, cylinders,
      interiorColor, exteriorColor, doors, seatingCapacity, trim, warranty, fuelType,
      motorsTrim, sellerType, location, neighbourhood, skip, take
    } = req.query;

    const where = {};

    if (make) where.make = make;
    if (model) where.model = model;
    if (minYear) where.year = { gte: parseInt(minYear) };
    if (maxYear) where.year = { ...(where.year || {}), lte: parseInt(maxYear) };
    if (minPrice) where.price = { gte: parseFloat(minPrice) };
    if (maxPrice) where.price = { ...(where.price || {}), lte: parseFloat(maxPrice) };
    if (minMileage) where.mileage = { gte: parseFloat(minMileage) };
    if (maxMileage) where.mileage = { ...(where.mileage || {}), lte: parseFloat(maxMileage) };
    if (isPremium !== undefined) where.isPremium = isPremium === 'true';
    if (bodyType) where.bodyType = bodyType;
    if (engineCapacity) where.engineCapacity = { gte: parseFloat(engineCapacity) };
    if (horsepower) where.horsepower = { gte: parseFloat(horsepower) };
    if (transmissionType) where.transmissionType = transmissionType;
    if (cylinders) where.cylinders = parseInt(cylinders);
    if (interiorColor) where.interiorColor = interiorColor;
    if (exteriorColor) where.exteriorColor = exteriorColor;
    if (doors) where.doors = parseInt(doors);
    if (seatingCapacity) where.seatingCapacity = parseInt(seatingCapacity);
    if (trim) where.trim = trim;
    if (warranty !== undefined) where.warranty = warranty === 'true';
    if (fuelType) where.fuelType = fuelType;
    if (motorsTrim) where.motorsTrim = motorsTrim;
    if (sellerType) where.sellerType = sellerType;
    if (location) where.location = location;
    if (neighbourhood) where.neighbourhood = neighbourhood;

    const parsedSkip = skip ? parseInt(skip) : 0;
    const parsedTake = take ? parseInt(take) : 10000000; // Default to 10,000,000

    const cars = await prisma.car.findMany({
      where,
      skip: parsedSkip,
      take: parsedTake,
    });
    res.json(cars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * @swagger
 * /api/cars/meta:
 *   get:
 *     summary: Retrieve metadata for car filters
 *     tags: [Cars]
 *     responses:
 *       200:
 *         description: An object containing unique car makes and models.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 makes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 models:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/cars/meta', async (req, res) => {
  try {
    const makes = await prisma.car.findMany({
      select: { make: true },
      distinct: ['make'],
      where: { make: { not: null, not: '' } },
    });
    const models = await prisma.car.findMany({
      select: { model: true },
      distinct: ['model'],
      where: { model: { not: null, not: '' } },
    });
    res.json({
      makes: makes.map((m) => m.make),
      models: models.map((m) => m.model),
    });
  } catch (error) {
    console.error('Error fetching car metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/cars/{id}:
 *   get:
 *     summary: Retrieve detailed information for a single car
 *     tags: [Cars]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The car's listingId
 *     responses:
 *       200:
 *         description: Detailed car information, including its history.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 make:
 *                   type: string
 *                 model:
 *                   type: string
 *                 year:
 *                   type: integer
 *                 price:
 *                   type: number
 *                 carHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       price:
 *                         type: number
 *       404:
 *         description: Car not found.
 */
app.get('/api/cars/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const car = await prisma.car.findUnique({
      where: { listingId: id },
      include: { history: true },
    });
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json(car);
  } catch (error) {
    console.error('Error fetching car by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
