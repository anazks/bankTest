require('dotenv').config();

const config = {
  baseUrl: (process.env.BANCO_GENERAL_BASE_URL || 'https://conexionbg.bgeneral.cloud').replace(/\/+$/, ''),
  clientId: process.env.BANCO_GENERAL_CLIENT_ID || '',
  clientSecret: process.env.BANCO_GENERAL_CLIENT_SECRET || '',
  timeout: 30000,
  endpoints: {
    autenticar: '/autenticacion/autenticar',
    saldos: '/h2h/saldos'
  }
};

/**
 * Validate that required credentials exist in environment variables
 */
function validateConfig() {
  const missing = [];
  if (!config.clientId || config.clientId === 'YOUR_CLIENT_ID') {
    missing.push('BANCO_GENERAL_CLIENT_ID');
  }
  if (!config.clientSecret || config.clientSecret === 'YOUR_CLIENT_SECRET') {
    missing.push('BANCO_GENERAL_CLIENT_SECRET');
  }

  if (missing.length > 0) {
    const errorMsg = `Banco General configuration missing: ${missing.join(', ')}. Please check your .env file.`;
    const err = new Error(errorMsg);
    err.isConfigurationError = true;
    err.statusCode = 500;
    throw err;
  }
}

module.exports = {
  config,
  validateConfig
};
