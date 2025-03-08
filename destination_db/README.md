# Destination Database Service

A PostgreSQL-based service for storing and managing travel destinations, categories, and operating hours.

## Features

- Full CRUD operations for destinations
- Category taxonomy management
- Geospatial search capabilities
- Operating hours tracking
- Caching with Redis
- Search and filtering functionality

## Prerequisites

- Node.js (v14+)
- PostgreSQL with PostGIS extension
- Redis (optional, for caching)

## Getting Started

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/destination-database-service.git
cd destination-database-service
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file in the root directory (see `.env.example` for required variables)

4. Set up PostgreSQL with PostGIS
```
CREATE DATABASE travel_destinations;
\c travel_destinations
CREATE EXTENSION postgis;
```

5. Start the server
```
npm run dev
```

## API Endpoints

### Destinations
- `GET /api/destinations` - Get all destinations
- `GET /api/destinations/:id` - Get destination by ID
- `POST /api/destinations` - Create new destination (admin only)
- `PUT /api/destinations/:id` - Update destination (admin only)
- `DELETE /api/destinations/:id` - Delete destination (admin only)
- `PUT /api/destinations/:id/operating-hours` - Update operating hours (admin only)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:identifier` - Get category by ID or slug
- `POST /api/categories` - Create new category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Search
- `GET /api/search` - Search destinations by various criteria
- `GET /api/search/nearby` - Find destinations near a location
- `GET /api/search/open` - Find currently open destinations

## Data Management

### Seeding the Database
```
npm run seed
```

### Importing from CSV
```
npm run import path/to/data.csv
```

## Testing
```
npm test
```

## License
This project is licensed under the MIT License