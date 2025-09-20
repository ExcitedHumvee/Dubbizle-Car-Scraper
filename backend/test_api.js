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

  console.log('\nAPI tests finished.');
}

runTests();
