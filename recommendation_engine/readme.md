# Recommendation Engine Service

## Overview

The Recommendation Engine Service is a core component of our travel itinerary application. It generates personalized travel recommendations based on user preferences, destination attributes, and contextual information. The service learns from user feedback to continually improve recommendation quality over time.

## Key Features

- **Personalized Recommendations**: Generates travel itineraries tailored to user preferences
- **Contextual Awareness**: Incorporates time of day, weather, and seasonality into recommendations
- **Continuous Learning**: Improves recommendations based on user feedback
- **Constraint Satisfaction**: Creates time-optimized itineraries with travel time considerations
- **Service Integration**: Communicates with User Profile and Destination Database services

## Architecture

The Recommendation Engine follows a microservice architecture and communicates with:

- **User Profile Service**: To access and update user preferences
- **Destination Database Service**: To retrieve destination information

## Technical Stack

- **Framework**: Node.js with Express
- **Database**: PostgreSQL with Sequelize ORM
- **Message Queue**: RabbitMQ with Celery for background tasks
- **Caching**: Redis (optional)
- **Authentication**: JWT-based authentication

## API Endpoints

### Recommendation Management

#### Generate Recommendations
- **Endpoint**: `POST /api/recommendations/generate`
- **Authentication**: Required
- **Description**: Generates personalized travel recommendations based on user profile and location
- **Request Body**:
  ```json
  {
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "date": "2025-03-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "preferences": {
      "categories": ["museums", "outdoorActivities"],
      "costLevel": 3,
      "activityLevel": "moderate"
    },
    "transportMode": "walking"
  }
  ```
- **Response**: Returns a personalized itinerary with recommended destinations and timing

#### Get Itinerary
- **Endpoint**: `GET /api/recommendations/itinerary/:itineraryId`
- **Authentication**: Required
- **Description**: Retrieves a previously generated itinerary
- **Response**: Returns the complete itinerary with destination details

#### Refine Itinerary
- **Endpoint**: `POST /api/recommendations/itinerary/:itineraryId/refine`
- **Authentication**: Required
- **Description**: Modifies an existing itinerary based on user adjustments
- **Request Body**:
  ```json
  {
    "removedDestinations": ["destination-id-1", "destination-id-2"],
    "addedConstraints": {
      "startTime": "10:00",
      "endTime": "16:00"
    },
    "transportMode": "transit"
  }
  ```
- **Response**: Returns the refined itinerary

### Feedback Management

#### Save Feedback
- **Endpoint**: `POST /api/recommendations/feedback/:recommendationId`
- **Authentication**: Required
- **Description**: Records user feedback on a recommendation, used for improving future recommendations
- **Request Body**:
  ```json
  {
    "rating": 4,
    "comments": "Great recommendation! Really enjoyed this place.",
    "status": "completed"
  }
  ```
- **Response**: Confirmation of saved feedback

### User Preference Management

#### Update User Preferences
- **Endpoint**: `POST /api/recommendations/update-preferences`
- **Authentication**: Required
- **Description**: Manually triggers an update of user preferences based on their feedback history
- **Response**: Confirmation that preference update has been queued

### System Management

#### Health Check
- **Endpoint**: `GET /health` or `GET /api/health`
- **Authentication**: Not required
- **Description**: Provides health status of the service and its dependencies
- **Response**:
  ```json
  {
    "status": "ok",
    "services": {
      "database": true,
      "redis": true,
      "rabbitmq": true
    }
  }
  ```

#### Metrics
- **Endpoint**: `GET /metrics` or `GET /api/metrics`
- **Authentication**: Not required
- **Description**: Provides operational metrics for monitoring
- **Response**: Various operational metrics including recommendation counts and response times

## Background Tasks

The service uses background processing for performance-intensive operations:

1. **Recommendation Generation**: For complex itineraries (optional)
2. **User Feature Updates**: Analyzes feedback to update user preferences
3. **Token Cleanup**: Removes expired authentication tokens

## Database Models

### Recommendation
Stores generated recommendations and their feedback status:
- `id`: Unique identifier (UUID)
- `userId`: Reference to user (UUID)
- `itineraryId`: Group identifier for recommendations in an itinerary
- `destinationId`: Reference to destination
- `score`: Computed relevance score
- `position`: Position in the itinerary sequence
- `reasoning`: Factors that influenced the recommendation
- `status`: Status (pending, accepted, rejected, completed)
- `feedback`: User feedback data

### UserPreference
Stores learned user preferences based on feedback:
- `userId`: User identifier (UUID, primary key)
- `categories`: Preferred destination categories
- `costLevel`: Preferred cost level (1-5)
- `activityLevel`: Preferred activity level
- `lastUpdated`: Timestamp of last update
- `source`: Origin of preference data (explicit, derived, default)

### UserToken
Temporarily stores user authentication tokens for background operations:
- `userId`: User identifier (UUID, primary key)
- `token`: Authentication token
- `expiresAt`: Token expiration timestamp

## Learning Mechanism

The recommendation engine improves over time through:

1. **Explicit Feedback**: Users rate and provide status updates on recommendations
2. **Implicit Patterns**: The system identifies patterns in user behavior
3. **Preference Evolution**: User preferences are automatically adjusted based on feedback
4. **Category Learning**: The system learns which categories a user consistently enjoys
5. **Context Association**: Correlations between contextual factors and user satisfaction are identified

## Configuration

The service uses environment variables for configuration:

```
# Server
PORT=3002
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=recommendation_db
DB_USER=postgres
DB_PASS=yourpassword

# Redis (optional)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_ENABLED=true
RABBITMQ_HOST=yourhost.rmq.cloudamqp.com
RABBITMQ_USER=username
RABBITMQ_PASS=password
RABBITMQ_VHOST=/
RABBITMQ_SSL=true

# Service URLs
USER_PROFILE_SERVICE_URL=http://localhost:3001
DESTINATION_SERVICE_URL=http://localhost:4000

# JWT
JWT_SECRET=your_secret_key
```

## Getting Started

### Prerequisites
- Node.js 14+
- PostgreSQL 12+
- Redis (optional)
- RabbitMQ (optional for development)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (see Configuration section)
4. Initialize the database:
   ```
   npx sequelize-cli db:migrate
   ```
5. Start the service:
   ```
   npm run dev   # Development mode
   npm start     # Production mode
   ```

### Testing

Run the test suite:
```
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

## Deployment

The service can be deployed using Docker:

```
docker build -t recommendation-engine .
docker run -p 3002:3002 --env-file .env recommendation-engine
```

## Error Handling

The service implements a consistent error handling pattern:
- HTTP 400: Bad request (validation errors)
- HTTP 401: Unauthorized (authentication errors)
- HTTP 404: Not found (resource not found)
- HTTP 500: Internal server error

All errors include a standardized JSON response with:
- `error`: Always true for error responses
- `errorCode`: Machine-readable error code
- `message`: Human-readable error message
- `statusCode`: HTTP status code
- `requestId`: Unique request identifier for tracing
- `details`: Additional error details (for validation errors)

## Security Considerations

- All endpoints require JWT authentication except health and metrics
- Tokens are verified using the shared JWT secret
- Service-to-service communication uses temporary user tokens
- Sensitive data is never logged

## Monitoring

The service exposes metrics for monitoring:
- Request counts and response times
- Recommendation generation statistics
- Error rates by type
- Feature update processing metrics

## Contributing

1. Follow the code style guide
2. Write tests for new features
3. Update documentation for API changes
4. Submit a pull request

## License