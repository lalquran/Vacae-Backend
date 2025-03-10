const request = require('supertest');
const app = require('../src/app');
const { setupTestDatabase, teardownTestDatabase } = require('./setup');

describe('Search API Endpoints', () => {
  let testDbName;
  
  beforeAll(async () => {
    // Set up test database
    testDbName = await setupTestDatabase();
    
    // We won't try to create test data here
    // Instead, we'll just check that the endpoints respond correctly
  });
  
  afterAll(async () => {
    // Clean up test database
    await teardownTestDatabase(testDbName);
  });
  
  // GET /api/search
  describe('GET /api/search', () => {
    it('should respond with a properly structured response', async () => {
      const res = await request(app)
        .get('/api/search')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
    });
    
    it('should accept query parameters', async () => {
      const res = await request(app)
        .get('/api/search?query=test&categories=attractions&costLevelMin=1&costLevelMax=5&page=1&limit=10')
        .expect(200);
      
      // Just checking the request doesn't error out
      expect(res.body).toHaveProperty('data');
    });
  });
  
  // GET /api/search/nearby
  describe('GET /api/search/nearby', () => {
    it('should require latitude and longitude', async () => {
      await request(app)
        .get('/api/search/nearby')
        .expect(400);
    });
    
    it('should respond with a properly structured response', async () => {
      const res = await request(app)
        .get('/api/search/nearby?lat=40.7484&lng=-73.9857&radius=5')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
    
    it('should accept additional filter parameters', async () => {
      const res = await request(app)
        .get('/api/search/nearby?lat=40.7484&lng=-73.9857&radius=5&categories=attractions&limit=10')
        .expect(200);
      
      // Just checking the request doesn't error out
      expect(res.body).toHaveProperty('data');
    });
  });
  
  // GET /api/search/open
  describe('GET /api/search/open', () => {
    it('should respond with a properly structured response', async () => {
      const res = await request(app)
        .get('/api/search/open')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
    
    it('should accept day and time parameters', async () => {
      const res = await request(app)
        .get('/api/search/open?day=1&time=12:00:00')
        .expect(200);
      
      // Just checking the request doesn't error out
      expect(res.body).toHaveProperty('data');
    });
    
    it('should accept location filtering parameters', async () => {
      const res = await request(app)
        .get('/api/search/open?day=1&time=12:00:00&lat=40.7484&lng=-73.9857&radius=5')
        .expect(200);
      
      // Just checking the request doesn't error out
      expect(res.body).toHaveProperty('data');
    });
  });
});