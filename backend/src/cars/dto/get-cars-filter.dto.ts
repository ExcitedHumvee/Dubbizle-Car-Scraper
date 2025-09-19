import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class GetCarsFilterDto {
  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minMileage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxMileage?: number;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsString()
  bodyType?: string;

  @IsOptional()
  @IsString()
  engineCapacity?: string;

  @IsOptional()
  @IsString()
  horsepower?: string;

  @IsOptional()
  @IsString()
  transmissionType?: string;

  @IsOptional()
  @IsString()
  cylinders?: string;

  @IsOptional()
  @IsString()
  interiorColor?: string;

  @IsOptional()
  @IsString()
  exteriorColor?: string;

  @IsOptional()
  @IsString()
  doors?: string;

  @IsOptional()
  @IsString()
  seatingCapacity?: string;

  @IsOptional()
  @IsString()
  trim?: string;

  @IsOptional()
  @IsString()
  warranty?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  motorsTrim?: string;

  @IsOptional()
  @IsString()
  sellerType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  neighbourhood?: string;
}
