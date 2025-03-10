const request = require('supertest');
const app = require('../src/app');
const { setupTestDatabase, teardownTestDatabase, generateTestToken } = require('./setup');
const Destination = require('../src/models/destination');
const Category = require('../src/models/category');
const OperatingHours = require('../src/models/operatingHours');
const { latLngToPoint } = require('../src/utils/geoUtils');
const sequelize = require('../src/config/database');

describe('Destination API Endpoints', () => {
  let testDbName;
  let adminToken;
  let userToken;
  let categoryId;
  
  beforeAll(async () => {
    // Set up test database
    testDbName = await setupTestDatabase();
    
    // Generate tokens
    adminToken = generateTestToken('admin');
    userToken = generateTestToken('user');
    
    // Make sure associations are set up
    const setupAssociations = require('../src/models/associations');
    setupAssociations();
    
    // Set up initial test data - first create categories
    const category = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'For testing purposes',
      icon: 'test'
    });
    
    categoryId = category.id;
    
    // Create test destinations
    const empireState = await Destination.create({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Empire State Building',
      description: 'Famous skyscraper in NYC',
      location: latLngToPoint(40.7484, -73.9857),
      address: {
        street: '350 5th Ave',
        city: 'New York',
        state: 'NY',
        postalCode: '10118',
        country: 'USA'
      },
      contactInfo: {
        phone: '+1-212-736-3100',
        website: 'https://www.esbnyc.com/'
      },
      visitDuration: 120,
      costLevel: 4,
      status: 'active'
    });
    
    await Destination.create({
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Central Park',
      description: 'Large urban park in NYC',
      location: latLngToPoint(40.7812, -73.9665),
      address: {
        city: 'New York',
        state: 'NY',
        country: 'USA'
      },
      visitDuration: 180,
      costLevel: 1,
      status: 'active'
    });
    
    // Create inactive destination for testing filters
    await Destination.create({
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Inactive Destination',
      description: 'This destination is not active',
      location: latLngToPoint(40.7000, -74.0000),
      visitDuration: 60,
      costLevel: 3,
      status: 'inactive'
    });
    
    // Manually create the association in the junction table
    try {
      // Use raw SQL to create the many-to-many relationship
      await sequelize.query(`
        INSERT INTO destination_categories ("destinationId", "categoryId", "createdAt", "updatedAt")
        VALUES ('11111111-1111-1111-1111-111111111111', '${categoryId}', NOW(), NOW())
      `);
    } catch (error) {
      console.error('Error creating manual association:', error);
    }
    
    // Add operating hours
    await OperatingHours.bulkCreate([
      {
        destinationId: '11111111-1111-1111-1111-111111111111',
        dayOfWeek: 1, // Monday
        openTime: '09:00:00',
        closeTime: '22:00:00'
      },
      {
        destinationId: '11111111-1111-1111-1111-111111111111',
        dayOfWeek: 2, // Tuesday
        openTime: '09:00:00',
        closeTime: '22:00:00'
      }
    ]);
  });
  
  afterAll(async () => {
    // Clean up test database
    await teardownTestDatabase(testDbName);
  });
  
  // GET /api/destinations
  describe('GET /api/destinations', () => {
    it('should return all active destinations', async () => {
      const res = await request(app)
        .get('/api/destinations')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2); // Only active destinations
      expect(res.body).toHaveProperty('pagination');
    });
    
    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/destinations?page=1&limit=1')
        .expect(200);
      
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.total).toBe(3); // Total active destinations
    });
    
    it('should support filtering by category', async () => {
      const res = await request(app)
        .get(`/api/destinations?category=test-category`)
        .expect(200);
      
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Empire State Building');
    });
    
    it('should support filtering by cost level', async () => {
      const res = await request(app)
        .get('/api/destinations?costLevel=1')
        .expect(200);
      
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Central Park');
    });
    
    it('should support sorting', async () => {
      const res = await request(app)
        .get('/api/destinations?sort=name&order=DESC')
        .expect(200);
      
      expect(res.body.data[0].name).toBe('Empire State Building');
      expect(res.body.data[1].name).toBe('Central Park');
    });
  });
  
  // GET /api/destinations/:id
  describe('GET /api/destinations/:id', () => {
    it('should return a specific destination', async () => {
      const res = await request(app)
        .get('/api/destinations/11111111-1111-1111-1111-111111111111')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe('Empire State Building');
      expect(res.body.data).toHaveProperty('categories');
      expect(res.body.data).toHaveProperty('operatingHours');
    });
    
    it('should return 404 for non-existent destination', async () => {
      await request(app)
        .get('/api/destinations/99999999-9999-9999-9999-999999999999')
        .expect(404);
    });
    
    it('should return details for an active destination', async () => {
      const res = await request(app)
        .get('/api/destinations/11111111-1111-1111-1111-111111111111')
        .expect(200);
      
      expect(res.body.data.status).toBe('active');
    });
  });
  
  // POST /api/destinations
  describe('POST /api/destinations', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/destinations')
        .send({
          name: 'New Destination',
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Destination',
          latitude: 40.7128,
          longitude: -74.0060
        })
        .expect(403);
    });
    
    it('should create a new destination', async () => {
      const newDestination = {
        name: 'Statue of Liberty',
        description: 'Famous statue in NYC Harbor',
        latitude: 40.6892,
        longitude: -74.0445,
        address: {
          city: 'New York',
          state: 'NY',
          country: 'USA'
        },
        visitDuration: 150,
        costLevel: 3,
        categoryIds: [categoryId],
        operatingHours: [
          {
            dayOfWeek: 1,
            openTime: '09:00:00',
            closeTime: '17:00:00'
          }
        ]
      };
      
      const res = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newDestination)
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe(newDestination.name);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.operatingHours).toHaveLength(1);
    });
    
    it('should require name field', async () => {
      await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          visitDuration: 60
        })
        .expect(400);
    });
    
    it('should require valid coordinates', async () => {
      await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Coordinates',
          latitude: 200, // Invalid latitude
          longitude: -74.0060
        })
        .expect(400);
    });
  });
  
  // PUT /api/destinations/:id
  describe('PUT /api/destinations/:id', () => {
    it('should require authentication', async () => {
      await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111')
        .send({ name: 'Updated Name' })
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);
    });
    
    it('should update an existing destination', async () => {
      const updateData = {
        name: 'Updated Empire State',
        description: 'Updated description',
        costLevel: 5
      };
      
      const res = await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe(updateData.name);
      expect(res.body.data.costLevel).toBe(updateData.costLevel);
    });
    
    it('should return 404 for non-existent destination', async () => {
      await request(app)
        .put('/api/destinations/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Non-existent Destination' })
        .expect(404);
    });
  });
  
  // DELETE /api/destinations/:id
  describe('DELETE /api/destinations/:id', () => {
    it('should require authentication', async () => {
      await request(app)
        .delete('/api/destinations/22222222-2222-2222-2222-222222222222')
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .delete('/api/destinations/22222222-2222-2222-2222-222222222222')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
    
    it('should delete a destination', async () => {
      await request(app)
        .delete('/api/destinations/22222222-2222-2222-2222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      // Verify it's deleted
      await request(app)
        .get('/api/destinations/22222222-2222-2222-2222-222222222222')
        .expect(404);
    });
    
    it('should return 404 for non-existent destination', async () => {
      await request(app)
        .delete('/api/destinations/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
  
  // PUT /api/destinations/:id/operating-hours
  describe('PUT /api/destinations/:id/operating-hours', () => {
    it('should require authentication', async () => {
      await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111/operating-hours')
        .send({ operatingHours: [] })
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111/operating-hours')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ operatingHours: [] })
        .expect(403);
    });
    
    it('should update operating hours', async () => {
      const newHours = {
        operatingHours: [
          {
            dayOfWeek: 1,
            openTime: '10:00:00',
            closeTime: '20:00:00'
          },
          {
            dayOfWeek: 2,
            openTime: '10:00:00',
            closeTime: '20:00:00'
          },
          {
            dayOfWeek: 3,
            openTime: '10:00:00',
            closeTime: '20:00:00'
          }
        ]
      };
      
      const res = await request(app)
        .put('/api/destinations/11111111-1111-1111-1111-111111111111/operating-hours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newHours)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].openTime).toBe('10:00:00');
    });
    
    it('should return 404 for non-existent destination', async () => {
      await request(app)
        .put('/api/destinations/99999999-9999-9999-9999-999999999999/operating-hours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          operatingHours: [
            { dayOfWeek: 1, openTime: '09:00:00', closeTime: '17:00:00' }
          ] 
        })
        .expect(404);
    });
  });
});