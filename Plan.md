# Project Plan: Car Data Visualization Dashboard

This document outlines the plan for creating a client-server application to search, visualize, and interact with a database of cars.

## 1. Project Setup

- **Directory Structure:**
  - Create a `backend` directory for the NestJS API server.
  - Create a `frontend` directory for the React client application.
- **Backend Initialization:**
  - Initialize a new NestJS project within the `backend` directory.
  - Move the existing `prisma` directory and its contents into the `backend` directory.
- **Frontend Initialization:**
  - Initialize a new React project (e.g., using Create React App or Vite) within the `frontend` directory.

## 2. Backend Development (NestJS)

The backend will be responsible for providing a robust API for the frontend to consume.

- **Prisma Integration:**
  - Create a `PrismaService` in a `prisma` module that will be globally available to other modules for database interactions.
- **Module Structure:**
  - Create a `CarsModule` to encapsulate all car-related logic.
- **Data Transfer Objects (DTOs):**
  - Define DTOs for validating incoming request query parameters for filtering cars (e.g., `GetCarsFilterDto`).
- **API Endpoints (`CarsController`):**
  - **`GET /api/cars`**:
    - Fetches a list of cars based on filter criteria.
    - **Query Parameters:** `make`, `model`, `minYear`, `maxYear`, `minPrice`, `maxPrice`, `minMileage`, `maxMileage`.
  - **`GET /api/cars/meta`**:
    - Fetches metadata for populating filter dropdowns, such as a list of unique car makes and models.
  - **`GET /api/cars/:id`**:
    - Fetches detailed information for a single car by its `listingId`, including its `CarHistory`.
- **Swagger Integration:**
  - Integrate Swagger UI for documenting and testing the API endpoints.

## 3. Frontend Development (React)

The frontend will provide an interactive user interface for filtering and visualizing the car data.

- **Project Structure:**
  - Organize the project into folders like `components`, `services`, `hooks`, and `contexts` for better maintainability.
- **State Management:**
  - Use a state management solution like React Context or Zustand to manage filter state and fetched data globally.
- **API Service:**
  - Create a dedicated service (e.g., `api.js`) to handle all API requests to the backend.
- **Component Breakdown:**
  - **`Filters.js`**: A component containing all the filter controls (dropdowns for make/model, sliders or input fields for ranges).
  - **`ScatterPlot.js`**: A reusable chart component that receives data and configuration to render the scatter plots. It will use a library like `react-chartjs-2` or `Recharts`.
  - **`CarDetailsModal.js`**: A modal component that appears when a data point is clicked on a graph, displaying detailed car information.
- **Graph Implementation:**
  - **Charts:** Use a charting library to render two scatter plots: "Price vs. Year" and "Price vs. Mileage".
  - **Interactivity:** Each point on the scatter plot will have an `onClick` handler that triggers the display of the `CarDetailsModal` with the corresponding car's data.
  - **Best-Fit Line:**
    - Use a library like `simple-statistics` or `regression-js` on the frontend to calculate the polynomial regression.
    - Render the calculated regression as a separate line series on the scatter plots to show the "best-fitting curved line".

## 4. Development Milestones

1.  **Milestone 1: Backend Foundation**
    - Set up the NestJS project and integrate Prisma.
    - Create the `GET /api/cars` endpoint without filtering.
    - Set up Swagger.
2.  **Milestone 2: Advanced Backend**
    - Implement the complete filtering logic for the `GET /api/cars` endpoint.
    - Create the `GET /api/cars/meta` and `GET /api/cars/:id` endpoints.
3.  **Milestone 3: Frontend Foundation**
    - Set up the React project.
    - Build the `Filters` component and manage its state.
4.  **Milestone 4: Data Visualization**
    - Integrate a charting library.
    - Fetch data from the backend and display the two scatter plots.
5.  **Milestone 5: Interactivity**
    - Implement the `onClick` functionality on the chart data points.
    - Display the `CarDetailsModal` with the selected car's details and history.
6.  **Milestone 6: Advanced Charting**
    - Implement the calculation and rendering of the best-fit curved line on both graphs.
