const app = require('../src/app');

let server;

module.exports.startServer = async () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => { // Using port 0 assigns a random available port
      resolve(server);
    });
  });
};

module.exports.stopServer = async () => {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
};