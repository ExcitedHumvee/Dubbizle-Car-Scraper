import React, { useState, useEffect } from 'react';
import './App.css';
import Filters from './components/Filters';
import ScatterPlot from './components/ScatterPlot';
import { fetchCars } from './services/api';

function App() {
  const [carData, setCarData] = useState([]);

  useEffect(() => {
    const getCarData = async () => {
      try {
        const cars = await fetchCars();
        setCarData(cars);
      } catch (error) {
        console.error('Error fetching car data:', error);
      }
    };
    getCarData();
  }, []);

  // Prepare data for Price vs. Year scatter plot
  const priceVsYearData = {
    datasets: [
      {
        label: 'Cars',
        data: carData.map(car => ({
          x: car.year,
          y: car.price,
        })),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  };

  // Prepare data for Price vs. Mileage scatter plot
  const priceVsMileageData = {
    datasets: [
      {
        label: 'Cars',
        data: carData.map(car => ({
          x: car.mileage,
          y: car.price,
        })),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
      },
    ],
  };

  const commonOptions = {
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
      },
      y: {
        type: 'linear',
        position: 'left',
      },
    },
  };

  const priceVsYearOptions = {
    ...commonOptions,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += `Price: ${context.parsed.y}`;
            }
            if (context.parsed.x !== null) {
              label += `, Year: ${context.parsed.x}`;
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Year',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Price',
        },
      },
    },
  };

  const priceVsMileageOptions = {
    ...commonOptions,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += `Price: ${context.parsed.y}`;
            }
            if (context.parsed.x !== null) {
              label += `, Mileage: ${context.parsed.x}`;
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Mileage',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Price',
        },
      },
    },
  };

  return (
    <div className="App">
      <Filters />
      <div className="charts-container">
        <h2>Price vs. Year</h2>
        <ScatterPlot data={priceVsYearData} options={priceVsYearOptions} />

        <h2>Price vs. Mileage</h2>
        <ScatterPlot data={priceVsMileageData} options={priceVsMileageOptions} />
      </div>
    </div>
  );
}

export default App;
