# Travel App - User Profile Service

A Node.js microservice for managing user profiles and preferences for the Travel App platform.

## Features

- User authentication (registration, login)
- Travel profile management
- Detailed travel preferences
- Preference learning based on feedback

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/travel-app-user-profile.git
cd travel-app-user-profile
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/travel-app
JWT_SECRET=your_jwt_secret_here
```

4. Start the development server
```
npm run dev
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login and get JWT token

### Profile
- GET /api/profiles - Get user profile
- PUT /api/profiles - Update user profile

### Preferences
- GET /api/preferences - Get user preferences
- PUT /api/preferences - Update user preferences
- PATCH /api/preferences/:category - Update specific preference category

## Project Structure

- `/src` - Application source code
  - `/config` - Configuration files
  - `/controllers` - Route controllers
  - `/middleware` - Express middleware
  - `/models` - MongoDB models
  - `/routes` - API routes
  - `/services` - Business logic
  - `/utils` - Utility functions
  - `app.js` - Application entry point

## Development

### Running Tests
```
npm test
```

### Code Linting
```
npm run lint
```

## Deployment

### Building for Production
```
npm run build
```

### Running in Production
```
npm start
```

## License
This project is licensed under the MIT License
*/