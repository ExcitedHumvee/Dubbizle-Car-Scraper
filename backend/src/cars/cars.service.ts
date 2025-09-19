import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetCarsFilterDto } from './dto/get-cars-filter.dto';

@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filterDto: GetCarsFilterDto) {
    const {
      make,
      model,
      minYear,
      maxYear,
      minPrice,
      maxPrice,
      minMileage,
      maxMileage,
      ...rest
    } = filterDto;

    const where: any = { ...rest };

    if (make) where.make = { contains: make, mode: 'insensitive' };
    if (model) where.model = { contains: model, mode: 'insensitive' };
    if (minYear) where.year = { ...where.year, gte: minYear };
    if (maxYear) where.year = { ...where.year, lte: maxYear };
    if (minPrice) where.price = { ...where.price, gte: minPrice };
    if (maxPrice) where.price = { ...where.price, lte: maxPrice };
    if (minMileage) where.mileage = { ...where.mileage, gte: minMileage };
    if (maxMileage) where.mileage = { ...where.mileage, lte: maxMileage };

    return this.prisma.car.findMany({ where });
  }

  async getMeta() {
    const makes = await this.prisma.car.findMany({
      select: { make: true },
      distinct: ['make'],
    });
    const models = await this.prisma.car.findMany({
      select: { model: true },
      distinct: ['model'],
    });
    return {
      makes: makes.map((m) => m.make).filter(Boolean),
      models: models.map((m) => m.model).filter(Boolean),
    };
  }

  findOne(id: string) {
    return this.prisma.car.findUnique({
      where: { listingId: id },
      include: { history: true },
    });
  }
}