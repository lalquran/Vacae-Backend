const { MongoMemoryServer } = require('mongodb-memory-server');
const { execSync } = require('child_process');
const { Client } = require('pg');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// PostgreSQL test database setup
async function setupTestDatabase() {
  // Create a unique test database name
  const testDbName = `test_destinations_${Date.now()}`;
  
  try {
    // Connect to default postgres database to create test database
    const client = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'postgres'
    });
    
    await client.connect();
    
    // Create test database
    await client.query(`CREATE DATABASE ${testDbName}`);
    await client.end();
    
    // Update sequelize config to use test database
    process.env.DB_NAME = testDbName;
    
    // Initialize database and PostGIS
    await sequelize.authenticate();
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');
    
    // Sync models
    await sequelize.sync({ force: true });
    
    return testDbName;
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

// Clean up test database
async function teardownTestDatabase(testDbName) {
  try {
    // Disconnect all connections
    await sequelize.close();
    
    // Connect to default postgres database to drop test database
    const client = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'postgres'
    });
    
    await client.connect();
    
    // Forcefully terminate any existing connections to the test database
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDbName}'
    `);
    
    // Drop test database
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await client.end();
  } catch (error) {
    console.error('Error tearing down test database:', error);
  }
}

// Generate test JWT token
function generateTestToken(role = 'user') {
  return jwt.sign(
    { id: 'test-user-id', email: 'test@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  generateTestToken
};