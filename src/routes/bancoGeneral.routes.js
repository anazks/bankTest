const express = require('express');
const router = express.Router();
const {
  getBalance,
  getReferences,
  listAccounts,
  testAuthentication,
  getTokenStatus,
  resetToken
} = require('../controllers/bancoGeneral.controller');

// Supported accounts catalog
router.get('/accounts', listAccounts);

// Test authentication endpoint
router.get('/auth/test', testAuthentication);

// Token cache status and reset
router.get('/token/status', getTokenStatus);
router.post('/token/clear', resetToken);

// Account balance inquiry
router.get('/balance/:accountNumber', getBalance);

// Account movements and references inquiry (working live on Banco General H2H)
router.get('/referencias/:accountNumber', getReferences);

module.exports = router;
