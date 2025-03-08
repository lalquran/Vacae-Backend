const request = require('supertest');
const dbHandler = require('./db-handler');
const serverHandler = require('./server-handler');
const app = require('../src/app');

describe('Authentication Endpoints', () => {
  let server;
  
  beforeAll(async () => {
    await dbHandler.connect();
    server = await serverHandler.startServer();
  });
  
  afterEach(async () => await dbHandler.clearDatabase());
  
  afterAll(async () => {
    await serverHandler.stopServer();
    await dbHandler.closeDatabase();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toEqual('test@example.com');
  });

  it('should not register a user with existing email', async () => {
    // First create a user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      });
    
    // Try to create again with same email
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!',
        firstName: 'Another',
        lastName: 'User'
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should login an existing user', async () => {
    // First create a user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'login@example.com',
        password: 'Password123!',
        firstName: 'Login',
        lastName: 'Test'
      });
    
    // Then try to login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'Password123!'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should not login with wrong password', async () => {
    // First create a user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'wrong@example.com',
        password: 'Password123!',
        firstName: 'Wrong',
        lastName: 'Password'
      });
    
    // Try with wrong password
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'WrongPassword123!'
      });
    
    expect(res.statusCode).toEqual(401);
  });
});