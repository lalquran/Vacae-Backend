const request = require('supertest');
const app = require('../src/app');
const { setupTestDatabase, teardownTestDatabase, generateTestToken } = require('./setup');

describe('Error Handling', () => {
  let testDbName;
  let adminToken;
  
  beforeAll(async () => {
    // Set up test database
    testDbName = await setupTestDatabase();
    adminToken = generateTestToken('admin');
  });
  
  afterAll(async () => {
    // Clean up test database
    await teardownTestDatabase(testDbName);
  });
  
  // Not Found error
  describe('Not Found Error', () => {
    it('should return 404 for non-existent endpoint', async () => {
      const res = await request(app)
        .get('/api/non-existent-endpoint')
      
      expect(res.status).toBe(404);
    });
  });
  
  // Validation errors
  describe('Validation Errors', () => {
    it('should validate destination creation params', async () => {
      const res = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Validation failed');
    });
    
    it('should validate coordinate ranges', async () => {
      const res = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Location',
          latitude: 100, // Invalid: outside range of -90 to 90
          longitude: -73.9857
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Validation failed');
    });
  });
  
  // Authentication errors
  describe('Authentication Errors', () => {
    it('should return 401 for missing token', async () => {
      const res = await request(app)
        .post('/api/destinations')
        .send({
          name: 'Test Destination',
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(401);
      
      expect(res.body).toHaveProperty('message');
    });
    
    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .post('/api/destinations')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({
          name: 'Test Destination',
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(401);
      
      expect(res.body).toHaveProperty('message');
    });
  });
  
  // Authorization errors
  describe('Authorization Errors', () => {
    it('should return 403 for insufficient permissions', async () => {
      const userToken = generateTestToken('user'); // Regular user, not admin
      
      const res = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Destination',
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(403);
      
      expect(res.body).toHaveProperty('message');
      expect(res.body.message.toLowerCase()).toContain('admin');
    });
  });
  
  // Data constraint errors
  describe('Data Constraint Errors', () => {
    it('should prevent duplicate slugs for categories', async () => {
      // First create a category
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Category',
          slug: 'test-category',
          description: 'For testing constraints'
        });
      
      // Try to create another with the same slug
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Another Test Category',
          slug: 'test-category', // Same slug as above
          description: 'Should fail'
        })
        .expect(409);
      
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('already exists');
    });
  });
  
  // Malformed request errors
  describe('Malformed Request Errors', () => {
    it('should handle malformed JSON gracefully', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{"name": "Malformed JSON", "slug": "malformed-json", description:}') // Invalid JSON
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
  });
});