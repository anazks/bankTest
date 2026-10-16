require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bancoGeneralRoutes = require('./src/routes/bancoGeneral.routes');
const { config } = require('./src/config/bancoGeneral.config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger for incoming API requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Root & Healthcheck
app.get('/', (req, res) => {
  res.json({
    name: 'Banco General Conexión BG Integration API',
    status: 'ONLINE',
    bgHost: config.baseUrl,
    endpoints: {
      accounts: 'GET /api/banco-general/accounts',
      balance: 'GET /api/banco-general/balance/:accountNumber',
      authTest: 'GET /api/banco-general/auth/test',
      tokenStatus: 'GET /api/banco-general/token/status'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Banco General routes
app.use('/api/banco-general', bancoGeneralRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Banco General Integration Server is running`);
    console.log(` Port: ${PORT}`);
    console.log(` Base BG URL: ${config.baseUrl}`);
    console.log(` Test: http://localhost:${PORT}/api/banco-general/accounts`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
