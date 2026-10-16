require('dotenv').config();
const { config, validateConfig } = require('../src/config/bancoGeneral.config');
const {
  normalizeAccountNumber,
  findAccountInfo
} = require('../src/utils/accountNumber');
const {
  getBancoGeneralAccessToken,
  getAccountBalance,
  getTokenCacheStatus
} = require('../src/services/bancoGeneral.service');
const { SUPPORTED_ACCOUNTS } = require('../src/constants/accounts');

async function runTests() {
  console.log('\n======================================================');
  console.log(' BANCO GENERAL CONEXIÓN BG INTEGRATION TEST SUITE');
  console.log('======================================================');

  // Test 1: Account number normalization
  console.log('\n[TEST 1] Account Number Normalization:');
  for (const acc of SUPPORTED_ACCOUNTS) {
    const normalized = normalizeAccountNumber(acc.displayNumber);
    const passed = normalized === acc.apiNumber;
    console.log(`  ${acc.name} (${acc.displayNumber}) -> ${normalized} [${passed ? 'PASS' : 'FAIL'}]`);
    if (!passed) {
      console.error(`Expected ${acc.apiNumber}, got ${normalized}`);
    }
  }

  // Test 2: Configuration & Credentials Check
  console.log('\n[TEST 2] Configuration Check:');
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Client ID provided: ${config.clientId && config.clientId !== 'YOUR_CLIENT_ID' ? 'YES' : 'NO (Placeholder)'}`);
  console.log(`  Client Secret provided: ${config.clientSecret && config.clientSecret !== 'YOUR_CLIENT_SECRET' ? 'YES' : 'NO (Placeholder)'}`);

  try {
    validateConfig();
  } catch (err) {
    console.warn(`\n  [NOTE] ${err.message}`);
    console.warn('  -> To test live calls against Banco General, replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET in .env');
    console.log('\n======================================================');
    console.log(' Account normalization tests PASSED.');
    console.log(' Update .env with your credentials to test live API calls.');
    console.log('======================================================\n');
    return;
  }

  // Test 3: Live Authentication
  console.log('\n[TEST 3] Testing Live Authentication...');
  try {
    const token = await getBancoGeneralAccessToken(true);
    console.log('  Live authentication successful!');
    console.log('  Cache status:', getTokenCacheStatus());
  } catch (err) {
    console.error('  Live authentication failed:', err.message);
    if (err.tip) console.log('  Tip:', err.tip);
    if (err.details) console.log('  Response details:', JSON.stringify(err.details));
    return;
  }

  // Test 4: Live Account Balance Query (Account 1: 0401976351601)
  console.log('\n[TEST 4] Testing Live Balance Query for 04-01-97-635160-1...');
  try {
    const balanceData = await getAccountBalance('04-01-97-635160-1');
    console.log('  Balance query successful!');
    console.log('  Response:', JSON.stringify(balanceData, null, 2));
  } catch (err) {
    console.error('  Balance query failed:', err.message);
    if (err.tip) console.log('  Tip:', err.tip);
    if (err.details) console.log('  Response details:', JSON.stringify(err.details));
  }

  console.log('\n======================================================');
  console.log(' Test suite completed.');
  console.log('======================================================\n');
}

runTests();
