import { Controller, Get, Query, Param } from '@nestjs/common';
import { CarsService } from './cars.service';
import { GetCarsFilterDto } from './dto/get-cars-filter.dto';

@Controller('api/cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get()
  findAll(@Query() filterDto: GetCarsFilterDto) {
    return this.carsService.findAll(filterDto);
  }

  @Get('meta')
  getMeta() {
    return this.carsService.getMeta();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(id);
  }
}