module.exports = {
    testEnvironment: 'node',
    testTimeout: 30000, // 30 seconds - database operations may take time
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/tests/',
      '/src/scripts/'
    ],
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/scripts/**'
    ],
    verbose: true,
    // Setup file to run before tests
    setupFilesAfterEnv: ['./tests/jest.setup.js']
  };
  
  // tests/jest.setup.js
  // Global setup for all tests
  process.env.NODE_ENV = 'test';