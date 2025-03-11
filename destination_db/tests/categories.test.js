const request = require('supertest');
const app = require('../src/app');
const { setupTestDatabase, teardownTestDatabase, generateTestToken } = require('./setup');
const Category = require('../src/models/category');

describe('Category API Endpoints', () => {
  let testDbName;
  let adminToken;
  let userToken;
  
  beforeAll(async () => {
    // Set up test database
    testDbName = await setupTestDatabase();
    
    // Generate tokens
    adminToken = generateTestToken('admin');
    userToken = generateTestToken('user');
    
    // Set up initial test data
    await Category.bulkCreate([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Attractions',
        slug: 'attractions',
        description: 'Tourist attractions and points of interest',
        icon: 'landmark',
        displayOrder: 1
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Restaurants',
        slug: 'restaurants',
        description: 'Places to eat',
        icon: 'utensils',
        displayOrder: 2
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Museums',
        slug: 'museums',
        description: 'Museums and galleries',
        icon: 'museum',
        parentId: '11111111-1111-1111-1111-111111111111',
        displayOrder: 1
      }
    ]);
  });
  
  afterAll(async () => {
    // Clean up test database
    await teardownTestDatabase(testDbName);
  });
  
  // GET /api/categories
  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      const res = await request(app)
        .get('/api/categories')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
    });
    
    it('should return categories ordered by displayOrder', async () => {
      const res = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(res.body.data[0].name).toBe('Attractions');
      expect(res.body.data[1].name).toBe('Museums');
    });
  });
  
  // GET /api/categories/:identifier (by ID)
  describe('GET /api/categories/:identifier (by ID)', () => {
    it('should return a specific category by ID', async () => {
      const res = await request(app)
        .get('/api/categories/11111111-1111-1111-1111-111111111111')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe('Attractions');
      expect(res.body.data).toHaveProperty('childCategories');
      expect(Array.isArray(res.body.data.childCategories)).toBe(true);
    });
    
    it('should return 404 for non-existent category ID', async () => {
      await request(app)
        .get('/api/categories/99999999-9999-9999-9999-999999999999')
        .expect(404);
    });
  });
  
  // GET /api/categories/:identifier (by slug)
  describe('GET /api/categories/:identifier (by slug)', () => {
    it('should return a specific category by slug', async () => {
      const res = await request(app)
        .get('/api/categories/attractions')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe('Attractions');
    });
    
    it('should return 404 for non-existent category slug', async () => {
      const req = await request(app)
        .get('/api/categories/non-existent-category')
        .expect(404);
    });
  });
  
  // POST /api/categories
  describe('POST /api/categories', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/categories')
        .send({
          name: 'New Category',
          slug: 'new-category'
        })
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Category',
          slug: 'new-category'
        })
        .expect(403);
    });
    
    it('should create a new category with admin token', async () => {
      const newCategory = {
        name: 'Parks',
        slug: 'parks',
        description: 'Public parks and gardens',
        icon: 'tree',
        displayOrder: 3
      };
      
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategory)
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe(newCategory.name);
      expect(res.body.data.slug).toBe(newCategory.slug);
    });
    
    it('should reject duplicate slugs', async () => {
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Slug',
          slug: 'attractions', // Already exists
          description: 'This slug already exists'
        })
        .expect(409);
    });
    
    it('should require name field', async () => {
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'missing-name',
          description: 'Missing name field'
        })
        .expect(400);
    });
    
    it('should require slug field', async () => {
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Slug',
          description: 'Missing slug field'
        })
        .expect(400);
    });
  });
  
  // PUT /api/categories/:id
  describe('PUT /api/categories/:id', () => {
    it('should require authentication', async () => {
      await request(app)
        .put('/api/categories/11111111-1111-1111-1111-111111111111')
        .send({ name: 'Updated Name' })
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .put('/api/categories/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);
    });
    
    it('should update an existing category', async () => {
      const updateData = {
        name: 'Updated Attractions',
        description: 'Updated description'
      };
      
      const res = await request(app)
        .put('/api/categories/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.name).toBe(updateData.name);
      expect(res.body.data.description).toBe(updateData.description);
    });
    
    it('should return 404 for non-existent category', async () => {
      await request(app)
        .put('/api/categories/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Non-existent Category' })
        .expect(404);
    });
  });
  
  // DELETE /api/categories/:id
  describe('DELETE /api/categories/:id', () => {
    it('should require authentication', async () => {
      await request(app)
        .delete('/api/categories/22222222-2222-2222-2222-222222222222')
        .expect(401);
    });
    
    it('should require admin role', async () => {
      await request(app)
        .delete('/api/categories/22222222-2222-2222-2222-222222222222')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
    
    it('should delete a category', async () => {
      await request(app)
        .delete('/api/categories/22222222-2222-2222-2222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      // Verify it's deleted
      await request(app)
        .delete('/api/categories/22222222-2222-2222-2222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
    it('should not allow deleting categories with children', async () => {
      // Try to delete Attractions which has a child category (Museums)
      await request(app)
        .delete('/api/categories/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });
    
    it('should return 404 for non-existent category', async () => {
      await request(app)
        .delete('/api/categories/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});