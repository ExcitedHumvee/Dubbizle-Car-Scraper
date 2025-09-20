import React, { useState, useEffect } from 'react';
import { fetchCarMetadata } from '../services/api';

function Filters() {
  const [filters, setFilters] = useState({
    make: '',
    model: '',
    minYear: '',
    maxYear: '',
    minPrice: '',
    maxPrice: '',
    minMileage: '',
    maxMileage: '',
    isPremium: '',
    spec: '',
    bodyType: '',
    engineCapacity: '',
    horsepower: '',
    transmissionType: '',
    cylinders: '',
    interiorColor: '',
    exteriorColor: '',
    doors: '',
    seatingCapacity: '',
    trim: '',
    warranty: '',
    fuelType: '',
    motorsTrim: '',
    sellerType: '',
    location: '',
    neighbourhood: '',
  });

  const [metadata, setMetadata] = useState({
    makes: [],
    models: [],
    bodyTypes: [],
    transmissionTypes: [],
    fuelTypes: [],
    specs: [],
    sellerTypes: [],
    locations: [],
    neighbourhoods: [],
  });

  useEffect(() => {
    const getMetadata = async () => {
      try {
        const fetchedMetadata = await fetchCarMetadata();
        setMetadata(fetchedMetadata);
      } catch (error) {
        console.error('Error fetching car metadata:', error);
      }
    };
    getMetadata();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Applied Filters:', filters);
    // In a real application, you would pass these filters to a parent component or a global state management solution
  };

  return (
    <div className="filters-container">
      <h2>Car Filters</h2>
      <form onSubmit={handleSubmit}>
        <div className="filter-group">
          <label htmlFor="make">Make:</label>
          <select id="make" name="make" value={filters.make} onChange={handleChange}>
            <option value="">All Makes</option>
            {metadata.makes.map(make => (
              <option key={make} value={make}>{make}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="model">Model:</label>
          <select id="model" name="model" value={filters.model} onChange={handleChange}>
            <option value="">All Models</option>
            {metadata.models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minYear">Min Year:</label>
          <input
            type="number"
            id="minYear"
            name="minYear"
            value={filters.minYear}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxYear">Max Year:</label>
          <input
            type="number"
            id="maxYear"
            name="maxYear"
            value={filters.maxYear}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="minPrice">Min Price:</label>
          <input
            type="number"
            id="minPrice"
            name="minPrice"
            value={filters.minPrice}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxPrice">Max Price:</label>
          <input
            type="number"
            id="maxPrice"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="minMileage">Min Mileage:</label>
          <input
            type="number"
            id="minMileage"
            name="minMileage"
            value={filters.minMileage}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxMileage">Max Mileage:</label>
          <input
            type="number"
            id="maxMileage"
            name="maxMileage"
            value={filters.maxMileage}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="isPremium">Is Premium:</label>
          <input
            type="checkbox"
            id="isPremium"
            name="isPremium"
            checked={filters.isPremium}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="spec">Spec:</label>
          <select id="spec" name="spec" value={filters.spec} onChange={handleChange}>
            <option value="">All Specs</option>
            {metadata.specs.map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="bodyType">Body Type:</label>
          <select id="bodyType" name="bodyType" value={filters.bodyType} onChange={handleChange}>
            <option value="">All Body Types</option>
            {metadata.bodyTypes.map(bodyType => (
              <option key={bodyType} value={bodyType}>{bodyType}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="engineCapacity">Engine Capacity:</label>
          <input
            type="text"
            id="engineCapacity"
            name="engineCapacity"
            value={filters.engineCapacity}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="horsepower">Horsepower:</label>
          <input
            type="text"
            id="horsepower"
            name="horsepower"
            value={filters.horsepower}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="transmissionType">Transmission Type:</label>
          <select id="transmissionType" name="transmissionType" value={filters.transmissionType} onChange={handleChange}>
            <option value="">All Transmission Types</option>
            {metadata.transmissionTypes.map(transmissionType => (
              <option key={transmissionType} value={transmissionType}>{transmissionType}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="cylinders">Cylinders:</label>
          <input
            type="number"
            id="cylinders"
            name="cylinders"
            value={filters.cylinders}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="interiorColor">Interior Color:</label>
          <input
            type="text"
            id="interiorColor"
            name="interiorColor"
            value={filters.interiorColor}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="exteriorColor">Exterior Color:</label>
          <input
            type="text"
            id="exteriorColor"
            name="exteriorColor"
            value={filters.exteriorColor}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="doors">Doors:</label>
          <input
            type="number"
            id="doors"
            name="doors"
            value={filters.doors}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="seatingCapacity">Seating Capacity:</label>
          <input
            type="number"
            id="seatingCapacity"
            name="seatingCapacity"
            value={filters.seatingCapacity}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="trim">Trim:</label>
          <input
            type="text"
            id="trim"
            name="trim"
            value={filters.trim}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="warranty">Warranty:</label>
          <input
            type="checkbox"
            id="warranty"
            name="warranty"
            checked={filters.warranty}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="fuelType">Fuel Type:</label>
          <select id="fuelType" name="fuelType" value={filters.fuelType} onChange={handleChange}>
            <option value="">All Fuel Types</option>
            {metadata.fuelTypes.map(fuelType => (
              <option key={fuelType} value={fuelType}>{fuelType}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="motorsTrim">Motors Trim:</label>
          <input
            type="text"
            id="motorsTrim"
            name="motorsTrim"
            value={filters.motorsTrim}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="sellerType">Seller Type:</label>
          <select id="sellerType" name="sellerType" value={filters.sellerType} onChange={handleChange}>
            <option value="">All Seller Types</option>
            {metadata.sellerTypes.map(sellerType => (
              <option key={sellerType} value={sellerType}>{sellerType}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="location">Location:</label>
          <select id="location" name="location" value={filters.location} onChange={handleChange}>
            <option value="">All Locations</option>
            {metadata.locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="neighbourhood">Neighbourhood:</label>
          <select id="neighbourhood" name="neighbourhood" value={filters.neighbourhood} onChange={handleChange}>
            <option value="">All Neighbourhoods</option>
            {metadata.neighbourhoods.map(neighbourhood => (
              <option key={neighbourhood} value={neighbourhood}>{neighbourhood}</option>
            ))}
          </select>
        </div>

        <button type="submit">Apply Filters</button>
      </form>
    </div>
  );
}

export default Filters;