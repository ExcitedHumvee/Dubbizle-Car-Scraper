const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('Starting API tests...');

  // Test 1: GET /api/cars without filters (cache hit/miss)
  try {
    console.log('\nTest 1: GET /api/cars (no filters)');
    const response = await axios.get(`${API_BASE_URL}/cars`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars.`);
    if (response.data.length > 0) {
      console.log('  Test 1 Passed: Fetched cars successfully.');
    } else {
      console.error('  Test 1 Failed: No cars fetched.');
    }
  } catch (error) {
    console.error('  Test 1 Failed:', error.message);
  }

  // Test 2: GET /api/cars with filters (make=Toyota)
  try {
    console.log('\nTest 2: GET /api/cars?make=Toyota');
    const response = await axios.get(`${API_BASE_URL}/cars?make=Toyota`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} Toyota cars.`);
    if (response.data.length > 0) {
      console.log('  Test 2 Passed: Fetched Toyota cars successfully.');
    } else {
      console.error('  Test 2 Failed: No Toyota cars fetched.');
    }
  } catch (error) {
    console.error('  Test 2 Failed:', error.message);
  }

  // Test 3: GET /api/cars/meta
  try {
    console.log('\nTest 3: GET /api/cars/meta');
    const response = await axios.get(`${API_BASE_URL}/cars/meta`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Metadata keys: ${Object.keys(response.data).join(', ')}`);
    if (response.data.makes && response.data.models) {
      console.log('  Test 3 Passed: Fetched metadata successfully.');
    } else {
      console.error('  Test 3 Failed: Metadata incomplete.');
    }
  } catch (error) {
    console.error('  Test 3 Failed:', error.message);
  }

  // Test 4: GET /api/cars/:id (Requires a valid listingId from Test 1 or 2)
  // For this test, we'll assume the first car from Test 1 or 2 exists and has a listingId
  try {
    console.log('\nTest 4: GET /api/cars/:id');
    const allCarsResponse = await axios.get(`${API_BASE_URL}/cars`);
    if (allCarsResponse.data.length > 0) {
      const firstCarId = allCarsResponse.data[0].listingId;
      if (firstCarId) {
        const response = await axios.get(`${API_BASE_URL}/cars/${firstCarId}`);
        console.log(`  Status: ${response.status}`);
        console.log(`  Fetched car ID: ${response.data.listingId}`);
        if (response.data.listingId === firstCarId) {
          console.log('  Test 4 Passed: Fetched single car successfully.');
        } else {
          console.error('  Test 4 Failed: Fetched car ID mismatch.');
        }
      } else {
        console.error('  Test 4 Failed: No listingId found for the first car.');
      }
    } else {
      console.error('  Test 4 Failed: No cars available to test /api/cars/:id.');
    }
  } catch (error) {
    console.error('  Test 4 Failed:', error.message);
  }

  // Additional tests for various filters

  // Test 5: model=Land Cruiser
  try {
    console.log('\nTest 5: GET /api/cars?model=Land Cruiser');
    const response = await axios.get(`${API_BASE_URL}/cars?model=Land Cruiser`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} Land Cruiser cars.`);
    if (response.data.length > 0) {
      console.log('  Test 5 Passed: Fetched Land Cruiser cars successfully.');
    } else {
      console.error('  Test 5 Failed: No Land Cruiser cars fetched.');
    }
  } catch (error) {
    console.error('  Test 5 Failed:', error.message);
  }

  // Test 6: minYear=2020
  try {
    console.log('\nTest 6: GET /api/cars?minYear=2020');
    const response = await axios.get(`${API_BASE_URL}/cars?minYear=2020`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with minYear 2020.`);
    if (response.data.length > 0) {
      console.log('  Test 6 Passed: Fetched cars with minYear 2020 successfully.');
    } else {
      console.error('  Test 6 Failed: No cars fetched with minYear 2020.');
    }
  } catch (error) {
    console.error('  Test 6 Failed:', error.message);
  }

  // Test 7: maxYear=2015
  try {
    console.log('\nTest 7: GET /api/cars?maxYear=2015');
    const response = await axios.get(`${API_BASE_URL}/cars?maxYear=2015`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with maxYear 2015.`);
    if (response.data.length > 0) {
      console.log('  Test 7 Passed: Fetched cars with maxYear 2015 successfully.');
    } else {
      console.error('  Test 7 Failed: No cars fetched with maxYear 2015.');
    }
  } catch (error) {
    console.error('  Test 7 Failed:', error.message);
  }

  // Test 8: minPrice=100000
  try {
    console.log('\nTest 8: GET /api/cars?minPrice=100000');
    const response = await axios.get(`${API_BASE_URL}/cars?minPrice=100000`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with minPrice 100000.`);
    if (response.data.length > 0) {
      console.log('  Test 8 Passed: Fetched cars with minPrice 100000 successfully.');
    } else {
      console.error('  Test 8 Failed: No cars fetched with minPrice 100000.');
    }
  } catch (error) {
    console.error('  Test 8 Failed:', error.message);
  }

  // Test 9: maxPrice=50000
  try {
    console.log('\nTest 9: GET /api/cars?maxPrice=50000');
    const response = await axios.get(`${API_BASE_URL}/cars?maxPrice=50000`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with maxPrice 50000.`);
    if (response.data.length > 0) {
      console.log('  Test 9 Passed: Fetched cars with maxPrice 50000 successfully.');
    } else {
      console.error('  Test 9 Failed: No cars fetched with maxPrice 50000.');
    }
  } catch (error) {
    console.error('  Test 9 Failed:', error.message);
  }

  // Test 10: minMileage=50000
  try {
    console.log('\nTest 10: GET /api/cars?minMileage=50000');
    const response = await axios.get(`${API_BASE_URL}/cars?minMileage=50000`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with minMileage 50000.`);
    if (response.data.length > 0) {
      console.log('  Test 10 Passed: Fetched cars with minMileage 50000 successfully.');
    } else {
      console.error('  Test 10 Failed: No cars fetched with minMileage 50000.');
    }
  } catch (error) {
    console.error('  Test 10 Failed:', error.message);
  }

  // Test 11: maxMileage=100000
  try {
    console.log('\nTest 11: GET /api/cars?maxMileage=100000');
    const response = await axios.get(`${API_BASE_URL}/cars?maxMileage=100000`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with maxMileage 100000.`);
    if (response.data.length > 0) {
      console.log('  Test 11 Passed: Fetched cars with maxMileage 100000 successfully.');
    } else {
      console.error('  Test 11 Failed: No cars fetched with maxMileage 100000.');
    }
  } catch (error) {
    console.error('  Test 11 Failed:', error.message);
  }

  // Test 12: isPremium=true
  try {
    console.log('\nTest 12: GET /api/cars?isPremium=true');
    const response = await axios.get(`${API_BASE_URL}/cars?isPremium=true`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} premium cars.`);
    if (response.data.length > 0) {
      console.log('  Test 12 Passed: Fetched premium cars successfully.');
    } else {
      console.error('  Test 12 Failed: No premium cars fetched.');
    }
  } catch (error) {
    console.error('  Test 12 Failed:', error.message);
  }

  // Test 13: spec=GCC
  try {
    console.log('\nTest 13: GET /api/cars?spec=GCC');
    const response = await axios.get(`${API_BASE_URL}/cars?spec=GCC`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} GCC spec cars.`);
    if (response.data.length > 0) {
      console.log('  Test 13 Passed: Fetched GCC spec cars successfully.');
    } else {
      console.error('  Test 13 Failed: No GCC spec cars fetched.');
    }
  } catch (error) {
    console.error('  Test 13 Failed:', error.message);
  }

  // Test 14: bodyType=SUV
  try {
    console.log('\nTest 14: GET /api/cars?bodyType=SUV');
    const response = await axios.get(`${API_BASE_URL}/cars?bodyType=SUV`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} SUV cars.`);
    if (response.data.length > 0) {
      console.log('  Test 14 Passed: Fetched SUV cars successfully.');
    } else {
      console.error('  Test 14 Failed: No SUV cars fetched.');
    }
  } catch (error) {
    console.error('  Test 14 Failed:', error.message);
  }

  // Test 15: transmissionType=Automatic Transmission
  try {
    console.log('\nTest 15: GET /api/cars?transmissionType=Automatic Transmission');
    const response = await axios.get(`${API_BASE_URL}/cars?transmissionType=Automatic Transmission`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} Automatic Transmission cars.`);
    if (response.data.length > 0) {
      console.log('  Test 15 Passed: Fetched Automatic Transmission cars successfully.');
    } else {
      console.error('  Test 15 Failed: No Automatic Transmission cars fetched.');
    }
  } catch (error) {
    console.error('  Test 15 Failed:', error.message);
  }

  // Test 16: fuelType=Petrol
  try {
    console.log('\nTest 16: GET /api/cars?fuelType=Petrol');
    const response = await axios.get(`${API_BASE_URL}/cars?fuelType=Petrol`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} Petrol cars.`);
    if (response.data.length > 0) {
      console.log('  Test 16 Passed: Fetched Petrol cars successfully.');
    } else {
      console.error('  Test 16 Failed: No Petrol cars fetched.');
    }
  } catch (error) {
    console.error('  Test 16 Failed:', error.message);
  }

  // Test 17: sellerType=Dealer
  try {
    console.log('\nTest 17: GET /api/cars?sellerType=Dealer');
    const response = await axios.get(`${API_BASE_URL}/cars?sellerType=Dealer`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} Dealer cars.`);
    if (response.data.length > 0) {
      console.log('  Test 17 Passed: Fetched Dealer cars successfully.');
    } else {
      console.error('  Test 17 Failed: No Dealer cars fetched.');
    }
  } catch (error) {
    console.error('  Test 17 Failed:', error.message);
  }

  // Test 18: location=Dubai
  try {
    console.log('\nTest 18: GET /api/cars?location=Dubai');
    const response = await axios.get(`${API_BASE_URL}/cars?location=Dubai`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars in Dubai.`);
    if (response.data.length > 0) {
      console.log('  Test 18 Passed: Fetched cars in Dubai successfully.');
    } else {
      console.error('  Test 18 Failed: No cars fetched in Dubai.');
    }
  } catch (error) {
    console.error('  Test 18 Failed:', error.message);
  }

  // Test 19: neighbourhood=Al Quoz
  try {
    console.log('\nTest 19: GET /api/cars?neighbourhood=Al Quoz');
    const response = await axios.get(`${API_BASE_URL}/cars?neighbourhood=Al Quoz`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars in Al Quoz.`);
    if (response.data.length > 0) {
      console.log('  Test 19 Passed: Fetched cars in Al Quoz successfully.');
    } else {
      console.error('  Test 19 Failed: No cars fetched in Al Quoz.');
    }
  } catch (error) {
    console.error('  Test 19 Failed:', error.message);
  }

  // Test 20: cylinders=6
  try {
    console.log('\nTest 20: GET /api/cars?cylinders=6');
    const response = await axios.get(`${API_BASE_URL}/cars?cylinders=6`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with 6 cylinders.`);
    if (response.data.length > 0) {
      console.log('  Test 20 Passed: Fetched cars with 6 cylinders successfully.');
    } else {
      console.error('  Test 20 Failed: No cars fetched with 6 cylinders.');
    }
  } catch (error) {
    console.error('  Test 20 Failed:', error.message);
  }

  // Test 21: horsepower=200 - 299 HP
  try {
    console.log('\nTest 21: GET /api/cars?horsepower=200 - 299 HP');
    const response = await axios.get(`${API_BASE_URL}/cars?horsepower=200 - 299 HP`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with 200-299 HP.`);
    if (response.data.length > 0) {
      console.log('  Test 21 Passed: Fetched cars with 200-299 HP successfully.');
    } else {
      console.error('  Test 21 Failed: No cars fetched with 200-299 HP.');
    }
  } catch (error) {
    console.error('  Test 21 Failed:', error.message);
  }

  // Test 22: engineCapacity=2000 - 2499 cc
  try {
    console.log('\nTest 22: GET /api/cars?engineCapacity=2000 - 2499 cc');
    const response = await axios.get(`${API_BASE_URL}/cars?engineCapacity=2000 - 2499 cc`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with 2000-2499 cc engine capacity.`);
    if (response.data.length > 0) {
      console.log('  Test 22 Passed: Fetched cars with 2000-2499 cc engine capacity successfully.');
    } else {
      console.error('  Test 22 Failed: No cars fetched with 2000-2499 cc engine capacity.');
    }
  } catch (error) {
    console.error('  Test 22 Failed:', error.message);
  }

  // Test 23: interiorColor=Black
  try {
    console.log('\nTest 23: GET /api/cars?interiorColor=Black');
    const response = await axios.get(`${API_BASE_URL}/cars?interiorColor=Black`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with Black interior.`);
    if (response.data.length > 0) {
      console.log('  Test 23 Passed: Fetched cars with Black interior successfully.');
    } else {
      console.error('  Test 23 Failed: No cars fetched with Black interior.');
    }
  } catch (error) {
    console.error('  Test 23 Failed:', error.message);
  }

  // Test 24: exteriorColor=White
  try {
    console.log('\nTest 24: GET /api/cars?exteriorColor=White');
    const response = await axios.get(`${API_BASE_URL}/cars?exteriorColor=White`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with White exterior.`);
    if (response.data.length > 0) {
      console.log('  Test 24 Passed: Fetched cars with White exterior successfully.');
    } else {
      console.error('  Test 24 Failed: No cars fetched with White exterior.');
    }
  } catch (error) {
    console.error('  Test 24 Failed:', error.message);
  }

  // Test 25: doors=4 door
  try {
    console.log('\nTest 25: GET /api/cars?doors=4 door');
    const response = await axios.get(`${API_BASE_URL}/cars?doors=4 door`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with 4 doors.`);
    if (response.data.length > 0) {
      console.log('  Test 25 Passed: Fetched cars with 4 doors successfully.');
    } else {
      console.error('  Test 25 Failed: No cars fetched with 4 doors.');
    }
  } catch (error) {
    console.error('  Test 25 Failed:', error.message);
  }

  // Test 26: seatingCapacity=5 Seater
  try {
    console.log('\nTest 26: GET /api/cars?seatingCapacity=5 Seater');
    const response = await axios.get(`${API_BASE_URL}/cars?seatingCapacity=5 Seater`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with 5 seating capacity.`);
    if (response.data.length > 0) {
      console.log('  Test 26 Passed: Fetched cars with 5 seating capacity successfully.');
    } else {
      console.error('  Test 26 Failed: No cars fetched with 5 seating capacity.');
    }
  } catch (error) {
    console.error('  Test 26 Failed:', error.message);
  }

  // Test 27: trim=Luxury
  try {
    console.log('\nTest 27: GET /api/cars?trim=Luxury');
    const response = await axios.get(`${API_BASE_URL}/cars?trim=Luxury`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with Luxury trim.`);
    if (response.data.length > 0) {
      console.log('  Test 27 Passed: Fetched cars with Luxury trim successfully.');
    } else {
      console.error('  Test 27 Failed: No cars fetched with Luxury trim.');
    }
  } catch (error) {
    console.error('  Test 27 Failed:', error.message);
  }

  // Test 28: warranty=true
  try {
    console.log('\nTest 28: GET /api/cars?warranty=true');
    const response = await axios.get(`${API_BASE_URL}/cars?warranty=true`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with warranty.`);
    if (response.data.length > 0) {
      console.log('  Test 28 Passed: Fetched cars with warranty successfully.');
    } else {
      console.error('  Test 28 Failed: No cars fetched with warranty.');
    }
  } catch (error) {
    console.error('  Test 28 Failed:', error.message);
  }

  // Test 29: motorsTrim=Other
  try {
    console.log('\nTest 29: GET /api/cars?motorsTrim=Other');
    const response = await axios.get(`${API_BASE_URL}/cars?motorsTrim=Other`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Fetched ${response.data.length} cars with Motors Trim Other.`);
    if (response.data.length > 0) {
      console.log('  Test 29 Passed: Fetched cars with Motors Trim Other successfully.');
    } else {
      console.error('  Test 29 Failed: No cars fetched with Motors Trim Other.');
    }
  } catch (error) {
    console.error('  Test 29 Failed:', error.message);
  }

  console.log('\nAPI tests finished.');
}

runTests();