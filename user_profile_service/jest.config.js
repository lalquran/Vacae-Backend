module.exports = {
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/'],
    verbose: true,
    testTimeout: 30000 // MongoDB connection can take time
  };