import React, { useState } from 'react';

function Filters() {
  const [filters, setFilters] = useState({
    make: '',
    model: '',
    minYear: '',
    maxYear: '',
    // Add more filter states as needed
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
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
          <input
            type="text"
            id="make"
            name="make"
            value={filters.make}
            onChange={handleChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="model">Model:</label>
          <input
            type="text"
            id="model"
            name="model"
            value={filters.model}
            onChange={handleChange}
          />
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

        <button type="submit">Apply Filters</button>
      </form>
    </div>
  );
}

export default Filters;