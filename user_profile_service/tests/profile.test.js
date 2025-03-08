const request = require('supertest');
const dbHandler = require('./db-handler');
const serverHandler = require('./server-handler');
const app = require('../src/app');

describe('Profile Endpoints', () => {
  let authToken;
  let server;
  
  beforeAll(async () => {
    await dbHandler.connect();
    
    // Create a test user and get token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'profile@example.com',
        password: 'Password123!',
        firstName: 'Profile',
        lastName: 'Test'
      });
    
    authToken = res.body.token;
  });
  
  afterAll(async () => {
    await serverHandler.stopServer();
    await dbHandler.closeDatabase()
  });

  it('should retrieve user profile', async () => {
    const res = await request(app)
      .get('/api/profiles')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('data');
  });

  it('should update user profile', async () => {
    const res = await request(app)
      .put('/api/profiles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        travelerType: ['foodie', 'culture'],
        pacePreference: 'busy',
        budgetLevel: 'luxury'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.pacePreference).toEqual('busy');
    expect(res.body.data.travelerType).toContain('foodie');
  });

  it('should not allow access without authentication', async () => {
    const res = await request(app)
      .get('/api/profiles');
    
    expect(res.statusCode).toEqual(401);
  });
});