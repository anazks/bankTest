const axios = require('axios');
const { config, validateConfig } = require('../config/bancoGeneral.config');
const { normalizeAccountNumber } = require('../utils/accountNumber');

/**
 * In-memory token cache
 */
let cachedToken = null;
let tokenExpiresAt = null; // null if no expiration provided

/**
 * Extracts the access token from any expected field in the BG response
 * @param {object} data 
 * @returns {string|null}
 */
function extractTokenFromResponse(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;

  // Banco General Conexión BG returns { "Token": "..." } (capital T)
  if (data.Token) return data.Token;
  if (data.token) return data.token;
  if (data.access_token) return data.access_token;
  if (data.accessToken) return data.accessToken;
  if (data.data?.Token) return data.data.Token;
  if (data.data?.token) return data.data.token;
  if (data.data?.access_token) return data.data.access_token;
  if (data.jwt) return data.jwt;
  if (data.bearerToken) return data.bearerToken;

  // Fallback: look for any key ending with 'token' case-insensitively
  for (const key of Object.keys(data)) {
    if (key.toLowerCase() === 'token' || key.toLowerCase().includes('token')) {
      if (typeof data[key] === 'string') return data[key];
    }
  }

  return null;
}

/**
 * Extracts expiration time from BG authentication response if present
 * @param {object} data 
 * @returns {number|null} Expiration timestamp in ms or null
 */
function extractExpirationFromResponse(data) {
  if (!data || typeof data !== 'object') return null;

  // expires_in in seconds (OAuth standard)
  const expiresIn = data.expires_in ?? data.expiresIn ?? data.data?.expires_in;
  if (typeof expiresIn === 'number' && expiresIn > 0) {
    // 60-second safety margin
    return Date.now() + (expiresIn * 1000) - 60000;
  }

  // Absolute timestamp / ISO date (exp or expiration or expires_at)
  const expiration = data.expiration ?? data.expires_at ?? data.expiresAt ?? data.exp;
  if (expiration) {
    const timestamp = typeof expiration === 'number' ? (expiration > 1e11 ? expiration : expiration * 1000) : Date.parse(expiration);
    if (!isNaN(timestamp)) {
      return timestamp - 60000;
    }
  }

  // Do not assume expiration if not provided by Banco General
  return null;
}

/**
 * Formats a user-friendly error from an Axios or Banco General error
 * Ensures credentials (secret/token) are NEVER included in error messages
 */
function formatBancoGeneralError(error, context) {
  const status = error.response?.status;
  const responseData = error.response?.data;

  let message = `Banco General ${context} error`;
  let tip = '';

  switch (status) {
    case 400:
      message = 'Bad Request: Invalid account number or request parameters.';
      tip = 'Check that the account number contains only valid digits.';
      break;
    case 401:
      message = 'Unauthorized: Invalid client credentials or expired/invalid token.';
      tip = 'Verify BANCO_GENERAL_CLIENT_ID and BANCO_GENERAL_CLIENT_SECRET in .env.';
      break;
    case 403:
      message = 'Forbidden: Client is authenticated but not authorized for this API/account.';
      tip = 'Verify that your IBM Client ID has permissions for the requested H2H Saldo service and account.';
      break;
    case 404:
      message = 'Not Found: API route or account resource does not exist on Banco General.';
      tip = 'Confirm the host is https://conexionbg.bgeneral.cloud (NOT IBM Cloud URL).';
      break;
    case 429:
      message = 'Too Many Requests: Rate limit exceeded on Banco General API.';
      tip = 'Reduce polling frequency or contact Banco General support for higher limits.';
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      message = `Banco General server error (${status}): Gateway or backend service unavailable.`;
      tip = 'Banco General API service may be experiencing downtime or maintenance.';
      break;
    default:
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'Request to Banco General timed out after 30 seconds.';
      } else if (error.code === 'ENOTFOUND') {
        message = 'Unable to resolve Banco General host: https://conexionbg.bgeneral.cloud';
      } else if (error.code) {
        message = `Network error connecting to Banco General: ${error.code}`;
      }
      break;
  }

  const err = new Error(message);
  err.status = status || (error.code === 'ECONNABORTED' ? 504 : 502);
  err.bgStatus = status;
  err.tip = tip;
  err.details = responseData || null;
  return err;
}

/**
 * Obtains an access token from Banco General with caching support.
 * 
 * Endpoint: GET https://conexionbg.bgeneral.cloud/autenticacion/autenticar
 * Headers:
 *   x-ibm-client-id: ${BANCO_GENERAL_CLIENT_ID}
 *   x-ibm-client-secret: ${BANCO_GENERAL_CLIENT_SECRET}
 *   Content-Type: application/json
 * 
 * @param {boolean} forceRefresh - If true, bypass cache and request fresh token
 * @returns {Promise<string>} Banco General access token
 */
async function getBancoGeneralAccessToken(forceRefresh = false) {
  validateConfig();

  // 1. Check cache
  const now = Date.now();
  const hasNotExpired = tokenExpiresAt === null || now < tokenExpiresAt;
  if (!forceRefresh && cachedToken && hasNotExpired) {
    return cachedToken;
  }

  const authUrl = `${config.baseUrl}${config.endpoints.autenticar}`;

  // Log without leaking credentials
  console.log(`[BG] Authentication URL: ${authUrl}`);

  try {
    const response = await axios.get(authUrl, {
      headers: {
        'x-ibm-client-id': config.clientId,
        'x-ibm-client-secret': config.clientSecret,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout
    });

    console.log(`[BG] Authentication status: ${response.status}`);

    const token = extractTokenFromResponse(response.data);
    const tokenReceived = Boolean(token);
    console.log(`[BG] Token received: ${tokenReceived ? 'YES' : 'NO'}`);

    if (!token) {
      console.error('[BG] Failed to extract token from authentication response:', JSON.stringify(response.data));
      const noTokenErr = new Error('Banco General authentication response did not contain an access token.');
      noTokenErr.status = 502;
      noTokenErr.details = response.data;
      throw noTokenErr;
    }

    // Update cache
    cachedToken = token;
    tokenExpiresAt = extractExpirationFromResponse(response.data);

    if (tokenExpiresAt) {
      console.log(`[BG] Token cached with expiry at: ${new Date(tokenExpiresAt).toISOString()}`);
    } else {
      console.log('[BG] Token cached without explicit expiration (reused until invalidation)');
    }

    return cachedToken;
  } catch (error) {
    console.log(`[BG] Authentication status: ${error.response?.status || 'Network Error'}`);
    console.log('[BG] Token received: NO');
    throw formatBancoGeneralError(error, 'authentication');
  }
}

/**
 * Fetches the account balance from Banco General for a given account number.
 * 
 * Endpoint: GET https://conexionbg.bgeneral.cloud/h2h/saldos?numeroCuenta={accountNumber}
 * Headers:
 *   x-ibm-client-id: ${BANCO_GENERAL_CLIENT_ID}
 *   Authorization: Bearer ${accessToken}
 *   Content-Type: application/json
 * 
 * @param {string|number} rawAccountNumber - e.g. "04-01-97-635160-1" or "0401976351601"
 * @returns {Promise<object>} Banco General balance API response payload
 */
async function getAccountBalance(rawAccountNumber) {
  validateConfig();

  // 1. Normalize account number (digits only)
  const accountNumber = normalizeAccountNumber(rawAccountNumber);

  // 2. Obtain / reuse access token
  let token = await getBancoGeneralAccessToken();

  const balanceUrl = `${config.baseUrl}${config.endpoints.saldos}`;
  console.log(`[BG] Balance URL: ${balanceUrl}?numeroCuenta=${accountNumber}`);
  console.log(`[BG] Account number: ${accountNumber}`);

  try {
    const response = await axios.get(balanceUrl, {
      params: {
        numeroCuenta: accountNumber
      },
      headers: {
        'x-ibm-client-id': config.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout
    });

    console.log(`[BG] Balance API status: ${response.status}`);
    console.log(`[BG] Balance API response:`, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    // If 401 Unauthorized, token may have expired or been revoked; attempt one auto-refresh
    if (error.response?.status === 401 && cachedToken) {
      console.warn('[BG] Received 401 on balance API. Invalidating token cache and retrying once...');
      clearTokenCache();

      try {
        const freshToken = await getBancoGeneralAccessToken(true);
        const retryResponse = await axios.get(balanceUrl, {
          params: {
            numeroCuenta: accountNumber
          },
          headers: {
            'x-ibm-client-id': config.clientId,
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout
        });

        console.log(`[BG] Balance API status (retry): ${retryResponse.status}`);
        console.log(`[BG] Balance API response (retry):`, JSON.stringify(retryResponse.data));
        return retryResponse.data;
      } catch (retryError) {
        console.log(`[BG] Balance API status: ${retryError.response?.status || 'Network Error'}`);
        if (retryError.response?.data) {
          console.log(`[BG] Balance API response:`, JSON.stringify(retryError.response.data));
        }
        throw formatBancoGeneralError(retryError, 'balance query');
      }
    }

    console.log(`[BG] Balance API status: ${error.response?.status || 'Network Error'}`);
    if (error.response?.data) {
      console.log(`[BG] Balance API response:`, JSON.stringify(error.response.data));
    }
    throw formatBancoGeneralError(error, 'balance query');
  }
}

/**
 * Fetches account transactions and latest balance capital via /h2h/cuentas/referencias
 * 
 * Endpoint: GET https://conexionbg.bgeneral.cloud/h2h/cuentas/referencias
 * Headers:
 *   x-ibm-client-id: ${BANCO_GENERAL_CLIENT_ID}
 *   Authorization: Bearer ${accessToken}
 *   Content-Type: application/json
 * 
 * @param {string|number} rawAccountNumber
 * @param {object} options Optional filters (fechaDesde, fechaHasta, cantidadRegistros, etc.)
 * @returns {Promise<object>}
 */
async function getAccountReferences(rawAccountNumber, options = {}) {
  validateConfig();

  const accountNumber = normalizeAccountNumber(rawAccountNumber);
  const token = await getBancoGeneralAccessToken();

  const url = `${config.baseUrl}/h2h/cuentas/referencias`;
  
  // Default to last 30 days if dates not provided
  const now = new Date();
  const past30Days = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  const fechaDesde = options.fechaDesde || past30Days.toISOString().replace('Z', '');
  const fechaHasta = options.fechaHasta || now.toISOString().replace('Z', '');
  const codProducto = options.codProducto || '3';
  const cantidadRegistros = options.cantidadRegistros || 20;

  console.log(`[BG] Account References URL: ${url}`);
  console.log(`[BG] Account: ${accountNumber}, CodProducto: ${codProducto}`);

  try {
    const response = await axios.get(url, {
      params: {
        CodProducto: codProducto,
        NumCuenta: accountNumber,
        Orden: options.orden || 'D',
        CantidadRegistros: cantidadRegistros,
        SaldoContable: 0,
        FechaDesde: fechaDesde,
        FechaHasta: fechaHasta
      },
      headers: {
        'x-ibm-client-id': config.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout
    });

    console.log(`[BG] References API status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.log(`[BG] References API status: ${error.response?.status || 'Network Error'}`);
    if (error.response?.data) {
      console.log(`[BG] References API response:`, JSON.stringify(error.response.data));
    }
    throw formatBancoGeneralError(error, 'account references query');
  }
}

/**
 * Clears the in-memory token cache
 */
function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = null;
}

/**
 * Returns current token cache status without revealing the token itself
 */
function getTokenCacheStatus() {
  return {
    hasCachedToken: Boolean(cachedToken),
    tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    isExpired: tokenExpiresAt ? Date.now() >= tokenExpiresAt : false
  };
}

module.exports = {
  getBancoGeneralAccessToken,
  getAccountBalance,
  getAccountReferences,
  clearTokenCache,
  getTokenCacheStatus,
  normalizeAccountNumber
};
