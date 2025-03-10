# Destination Database Service

A PostgreSQL-based service for storing and managing travel destinations, categories, and operating hours. This service provides geospatial capabilities, advanced search functionality, and caching for optimal performance.

## Features

- Full CRUD operations for destinations and categories
- Geographic search for nearby locations using PostGIS
- Hierarchical category taxonomy
- Operating hours tracking with support for special cases (24/7, seasonal hours)
- Review and rating system
- Redis-based caching for performance optimization
- Authentication and authorization for admin operations

## Tech Stack

- **Node.js & Express**: Backend API framework
- **PostgreSQL & PostGIS**: Spatial database for location data
- **Sequelize ORM**: Database modeling and queries
- **Redis**: Caching layer for improved performance
- **JWT**: Authentication for protected routes
- **Jest**: Testing framework

## Getting Started

### Prerequisites

- Node.js (v14+)
- PostgreSQL with PostGIS extension
- Redis (optional, falls back to in-memory cache)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/destination-database-service.git
cd destination-database-service
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory:
```
# Server
PORT=4000
NODE_ENV=development
JWT_SECRET=your_generated_jwt_secret_here

# Database
DB_HOST=your_postgres_host
DB_PORT=5432
DB_NAME=travel_destinations
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Redis Cache
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

4. Set up PostgreSQL with PostGIS
```sql
CREATE DATABASE travel_destinations;
\c travel_destinations
CREATE EXTENSION IF NOT EXISTS postgis;
```

5. Seed the database
```bash
npm run seed:enhanced
```

6. Start the development server
```bash
npm run dev
```

## API Documentation

### Categories

#### Get All Categories
- **URL**: `/api/categories`
- **Method**: `GET`
- **Description**: Retrieves all categories in a hierarchical structure
- **Query Parameters**:
  - None
- **Success Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "...",
      "name": "Attractions",
      "slug": "attractions",
      "description": "Places of interest for tourists and visitors",
      "icon": "landmark",
      "displayOrder": 1,
      "childCategories": [...]
    },
    ...
  ]
}
```

#### Get Category by ID or Slug
- **URL**: `/api/categories/:identifier`
- **Method**: `GET`
- **Description**: Retrieves a specific category by ID or slug
- **URL Parameters**:
  - `identifier`: UUID or slug of the category
- **Success Response**: `200 OK`
```json
{
  "data": {
    "id": "...",
    "name": "Museums",
    "slug": "museums",
    "description": "Art, history, and science museums",
    "parentId": "...",
    "icon": "museum",
    "displayOrder": 1,
    "childCategories": [...]
  }
}
```

#### Create Category (Admin Only)
- **URL**: `/api/categories`
- **Method**: `POST`
- **Description**: Creates a new category
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **Body**:
```json
{
  "name": "New Category",
  "slug": "new-category",
  "description": "Description of the new category",
  "parentId": null,
  "icon": "icon-name",
  "displayOrder": 5
}
```
- **Success Response**: `201 Created`
```json
{
  "message": "Category created successfully",
  "data": {
    "id": "...",
    "name": "New Category",
    "slug": "new-category",
    "description": "Description of the new category",
    "parentId": null,
    "icon": "icon-name",
    "displayOrder": 5
  }
}
```

#### Update Category (Admin Only)
- **URL**: `/api/categories/:id`
- **Method**: `PUT`
- **Description**: Updates an existing category
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **URL Parameters**:
  - `id`: UUID of the category
- **Body**:
```json
{
  "name": "Updated Category Name",
  "description": "Updated description",
  "icon": "new-icon"
}
```
- **Success Response**: `200 OK`
```json
{
  "message": "Category updated successfully",
  "data": {
    "id": "...",
    "name": "Updated Category Name",
    "slug": "new-category",
    "description": "Updated description",
    "parentId": null,
    "icon": "new-icon",
    "displayOrder": 5
  }
}
```

#### Delete Category (Admin Only)
- **URL**: `/api/categories/:id`
- **Method**: `DELETE`
- **Description**: Deletes a category (only if it has no child categories)
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **URL Parameters**:
  - `id`: UUID of the category
- **Success Response**: `200 OK`
```json
{
  "message": "Category deleted successfully"
}
```

### Destinations

#### Get All Destinations
- **URL**: `/api/destinations`
- **Method**: `GET`
- **Description**: Retrieves a paginated list of destinations
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Results per page (default: 20)
  - `sort`: Field to sort by (default: name)
  - `order`: Sort order (ASC or DESC)
  - `category`: Filter by category slug
  - `costLevel`: Filter by cost level (1-5)
- **Success Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "...",
      "name": "Empire State Building",
      "description": "...",
      "location": {...},
      "address": {...},
      "contactInfo": {...},
      "visitDuration": 120,
      "costLevel": 4,
      "categories": [...],
      "operatingHours": [...]
    },
    ...
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

#### Get Destination by ID
- **URL**: `/api/destinations/:id`
- **Method**: `GET`
- **Description**: Retrieves a specific destination with all details
- **URL Parameters**:
  - `id`: UUID of the destination
- **Success Response**: `200 OK`
```json
{
  "data": {
    "id": "...",
    "name": "Empire State Building",
    "description": "...",
    "location": {...},
    "address": {...},
    "contactInfo": {...},
    "visitDuration": 120,
    "costLevel": 4,
    "categories": [...],
    "operatingHours": [...],
    "reviews": [...]
  }
}
```

#### Create Destination (Admin Only)
- **URL**: `/api/destinations`
- **Method**: `POST`
- **Description**: Creates a new destination
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **Body**:
```json
{
  "name": "New Destination",
  "description": "Description of the destination",
  "latitude": 40.7484,
  "longitude": -73.9857,
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  },
  "contactInfo": {
    "phone": "+1-123-456-7890",
    "website": "https://example.com"
  },
  "visitDuration": 120,
  "costLevel": 3,
  "categoryIds": ["uuid1", "uuid2"],
  "operatingHours": [
    {
      "dayOfWeek": 1,
      "openTime": "09:00:00",
      "closeTime": "17:00:00"
    },
    ...
  ]
}
```
- **Success Response**: `201 Created`
```json
{
  "message": "Destination created successfully",
  "data": {...}
}
```

#### Update Destination (Admin Only)
- **URL**: `/api/destinations/:id`
- **Method**: `PUT`
- **Description**: Updates an existing destination
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **URL Parameters**:
  - `id`: UUID of the destination
- **Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "costLevel": 4
}
```
- **Success Response**: `200 OK`
```json
{
  "message": "Destination updated successfully",
  "data": {...}
}
```

#### Delete Destination (Admin Only)
- **URL**: `/api/destinations/:id`
- **Method**: `DELETE`
- **Description**: Deletes a destination
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **URL Parameters**:
  - `id`: UUID of the destination
- **Success Response**: `200 OK`
```json
{
  "message": "Destination deleted successfully"
}
```

#### Update Operating Hours (Admin Only)
- **URL**: `/api/destinations/:id/operating-hours`
- **Method**: `PUT`
- **Description**: Updates operating hours for a destination
- **Headers**: 
  - `Authorization: Bearer {jwt_token}`
- **URL Parameters**:
  - `id`: UUID of the destination
- **Body**:
```json
{
  "operatingHours": [
    {
      "dayOfWeek": 1,
      "openTime": "09:00:00",
      "closeTime": "17:00:00"
    },
    {
      "dayOfWeek": 2,
      "openTime": "09:00:00",
      "closeTime": "17:00:00"
    },
    ...
  ]
}
```
- **Success Response**: `200 OK`
```json
{
  "message": "Operating hours updated successfully",
  "data": [...]
}
```

### Search

#### Search Destinations
- **URL**: `/api/search`
- **Method**: `GET`
- **Description**: Searches for destinations with various filters
- **Query Parameters**:
  - `query`: Text search term
  - `categories`: Comma-separated category slugs
  - `costLevelMin`: Minimum cost level (1-5)
  - `costLevelMax`: Maximum cost level (1-5)
  - `page`: Page number (default: 1)
  - `limit`: Results per page (default: 20)
  - `sort`: Field to sort by (default: name)
  - `order`: Sort order (ASC or DESC)
- **Success Response**: `200 OK`
```json
{
  "data": [...],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

#### Find Nearby Destinations
- **URL**: `/api/search/nearby`
- **Method**: `GET`
- **Description**: Finds destinations near a specific location
- **Query Parameters**:
  - `lat`: Latitude (required)
  - `lng`: Longitude (required)
  - `radius`: Search radius in kilometers (default: 5)
  - `categories`: Comma-separated category slugs
  - `limit`: Maximum results to return (default: 20)
- **Success Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "...",
      "name": "Central Park",
      "description": "...",
      "distance_km": 1.2,
      ...
    },
    ...
  ]
}
```

#### Find Open Destinations
- **URL**: `/api/search/open`
- **Method**: `GET`
- **Description**: Finds destinations that are currently open or open at a specific time
- **Query Parameters**:
  - `day`: Day of week (0-6, 0=Sunday)
  - `time`: Time in format HH:MM:SS
  - `categories`: Comma-separated category slugs
  - `lat`: Latitude for location filtering
  - `lng`: Longitude for location filtering
  - `radius`: Search radius in kilometers
- **Success Response**: `200 OK`
```json
{
  "data": [...]
}
```

## Data Models

### Category

```javascript
{
  id: UUID,
  name: String,
  slug: String,
  description: String,
  parentId: UUID,
  icon: String,
  displayOrder: Integer,
  childCategories: Array
}
```

### Destination

```javascript
{
  id: UUID,
  name: String,
  description: Text,
  location: PostGIS Point,
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  contactInfo: {
    phone: String,
    email: String,
    website: String
  },
  visitDuration: Integer,
  costLevel: Integer,
  popularity: Float,
  image: String,
  imageGallery: Array,
  attributes: Object,
  status: String,
  seasonality: Object,
  categories: Array,
  operatingHours: Array,
  reviews: Array
}
```

### Operating Hours

```javascript
{
  id: UUID,
  destinationId: UUID,
  dayOfWeek: Integer,
  openTime: Time,
  closeTime: Time,
  is24Hours: Boolean,
  seasonStart: Date,
  seasonEnd: Date,
  notes: String
}
```

### Review

```javascript
{
  id: UUID,
  destinationId: UUID,
  userId: String,
  rating: Float,
  comment: Text,
  visitDate: Date,
  visitContext: String,
  attributes: Object,
  status: String
}
```

## Development

### Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run seed` - Seed the database with basic data
- `npm run seed:enhanced` - Seed the database with comprehensive data
- `npm run import` - Import destinations from CSV file

### Running Tests

The service includes comprehensive tests for all endpoints:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suites
npm run test:categories
npm run test:destinations
npm run test:search
```

### Importing Data

You can import destination data from CSV files:

```bash
npm run import path/to/your/data.csv
```

For updating existing destinations:

```bash
npm run import path/to/your/data.csv --update
```

## Error Handling

The API uses standard HTTP status codes:

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses follow this format:

```json
{
  "error": true,
  "message": "Error message",
  "details": "Additional error details (optional)"
}
```

## Architecture

The service follows a layered architecture:

- **Routes**: Define API endpoints and HTTP methods
- **Controllers**: Handle request/response logic
- **Services**: Implement business logic
- **Models**: Define data structure and relationships
- **Middleware**: Cross-cutting concerns (auth, validation, caching)

## License

This project is licensed under the MIT License.