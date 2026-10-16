const {
  getAccountBalance,
  getAccountReferences,
  getBancoGeneralAccessToken,
  clearTokenCache,
  getTokenCacheStatus
} = require('../services/bancoGeneral.service');
const {
  normalizeAccountNumber,
  findAccountInfo
} = require('../utils/accountNumber');
const { SUPPORTED_ACCOUNTS } = require('../constants/accounts');

/**
 * Controller to fetch balance for a given account number
 * GET /api/banco-general/balance/:accountNumber
 */
async function getBalance(req, res) {
  const { accountNumber } = req.params;

  try {
    const normalized = normalizeAccountNumber(accountNumber);
    const accountInfo = findAccountInfo(normalized);

    const data = await getAccountBalance(normalized);

    return res.status(200).json({
      success: true,
      accountNumber: normalized,
      accountInfo: accountInfo || null,
      data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      tip: error.tip || undefined,
      details: error.details || undefined
    });
  }
}

/**
 * Controller to fetch account movements and references
 * GET /api/banco-general/referencias/:accountNumber
 */
async function getReferences(req, res) {
  const { accountNumber } = req.params;

  try {
    const normalized = normalizeAccountNumber(accountNumber);
    const accountInfo = findAccountInfo(normalized);

    const data = await getAccountReferences(normalized, req.query);

    return res.status(200).json({
      success: true,
      accountNumber: normalized,
      accountInfo: accountInfo || null,
      data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      tip: error.tip || undefined,
      details: error.details || undefined
    });
  }
}

/**
 * Lists all known / supported Banco General accounts
 * GET /api/banco-general/accounts
 */
function listAccounts(req, res) {
  return res.status(200).json({
    success: true,
    count: SUPPORTED_ACCOUNTS.length,
    accounts: SUPPORTED_ACCOUNTS
  });
}

/**
 * Tests authentication against Banco General without returning sensitive tokens
 * GET /api/banco-general/auth/test
 */
async function testAuthentication(req, res) {
  try {
    await getBancoGeneralAccessToken(true);
    return res.status(200).json({
      success: true,
      message: 'Successfully authenticated with Banco General Conexión BG API.',
      tokenReceived: true
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      tip: error.tip || undefined,
      details: error.details || undefined
    });
  }
}

/**
 * Returns cache status without leaking the access token
 * GET /api/banco-general/token/status
 */
function getTokenStatus(req, res) {
  return res.status(200).json({
    success: true,
    ...getTokenCacheStatus()
  });
}

/**
 * Clears the token cache
 * POST /api/banco-general/token/clear
 */
function resetToken(req, res) {
  clearTokenCache();
  return res.status(200).json({
    success: true,
    message: 'Banco General token cache cleared.'
  });
}

module.exports = {
  getBalance,
  getReferences,
  listAccounts,
  testAuthentication,
  getTokenStatus,
  resetToken
};
