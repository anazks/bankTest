const { SUPPORTED_ACCOUNTS } = require('../constants/accounts');

/**
 * Normalizes a bank account number by removing all dashes, spaces, and non-digits.
 * 
 * Examples:
 * 04-01-97-635160-1 -> 0401976351601
 * 03-71-01-149790-5 -> 0371011497905
 * 04-71-96-450265-4 -> 0471964502654
 * 03-27-00-000060-0 -> 0327000000600
 * 04-71-00-000301-0 -> 0471000003010
 * 
 * @param {string|number} accountNumber
 * @returns {string} Normalized numeric account string
 */
function normalizeAccountNumber(accountNumber) {
  if (accountNumber === undefined || accountNumber === null) {
    const err = new Error('Account number is required');
    err.status = 400;
    throw err;
  }

  const raw = String(accountNumber).trim();
  const normalized = raw.replace(/\D/g, '');

  if (!normalized) {
    const err = new Error(`Invalid account number format: "${raw}". Must contain digits.`);
    err.status = 400;
    throw err;
  }

  return normalized;
}

/**
 * Finds known account metadata from the catalog if present
 * @param {string|number} accountNumber 
 * @returns {object|null}
 */
function findAccountInfo(accountNumber) {
  try {
    const normalized = normalizeAccountNumber(accountNumber);
    return SUPPORTED_ACCOUNTS.find(acc => acc.apiNumber === normalized) || null;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeAccountNumber,
  findAccountInfo
};
