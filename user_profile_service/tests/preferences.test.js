const request = require('supertest');
const dbHandler = require('./db-handler');
const serverHandler = require('./server-handler');
const app = require('../src/app');

describe('Preferences Endpoints', () => {
  let authToken;
  let server;
  
  beforeAll(async () => {
    await dbHandler.connect();
    server = await serverHandler.startServer();
    
    // Create a test user and get token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'prefs@example.com',
        password: 'Password123!',
        firstName: 'Preference',
        lastName: 'Test'
      });
    
    authToken = res.body.token;
  });

  // afterEach(async () => await dbHandler.clearDatabase());
  
  afterAll(async () => {
    await dbHandler.closeDatabase()
  });

  it('should retrieve user preferences', async () => {
    const res = await request(app)
      .get('/api/preferences')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('data');
  });

  it('should update user preferences', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        categories: {
          museums: 5,
          food: 4,
          shopping: 2
        },
        schedule: {
          morningStart: "07:00",
          eveningEnd: "23:00"
        }
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.categories.museums).toEqual(5);
    expect(res.body.data.schedule.morningStart).toEqual("07:00");
  });

  it('should update specific preference category', async () => {
    const res = await request(app)
      .patch('/api/preferences/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        nightlife: 5,
        relaxation: 1
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.categories.nightlife).toEqual(5);
  });
});