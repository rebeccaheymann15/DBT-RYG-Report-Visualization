const app = require('./index.js');

// Vercel expects the Express app to be the default export
// This makes it compatible with serverless functions
module.exports = app;
