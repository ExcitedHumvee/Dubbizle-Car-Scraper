const API_BASE_URL = 'http://localhost:3000/api';

export const fetchCars = async (filters) => {
  const query = new URLSearchParams(filters).toString();
  const response = await fetch(`${API_BASE_URL}/cars?${query}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const fetchCarMetadata = async () => {
  const response = await fetch(`${API_BASE_URL}/cars/meta`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const fetchCarDetails = async (id) => {
  const response = await fetch(`${API_BASE_URL}/cars/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};