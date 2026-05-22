// index.js
require('dotenv').config();

const buildApp = require('./src/app');
const logger = require('./src/lib/logger');

const PORT = parseInt(process.env.PORT || '4002', 10);
const app = buildApp();

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'auth-service running');
});
