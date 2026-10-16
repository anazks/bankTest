# Banco General Conexión BG - API Integration

Production-ready Node.js/Express integration for Banco General's Conexión BG API.

## Features

- **Host**: Uses the official Banco General cloud host: `https://conexionbg.bgeneral.cloud` (replaces deprecated IBM Cloud APIC domain).
- **Authentication**: Fetches access token via `GET /autenticacion/autenticar` with IBM client headers.
- **Smart Token Caching**: In-memory caching with automatic token expiration tracking and automatic single-retry token refresh on `401 Unauthorized`.
- **Account Normalization**: Automatically converts dashed or formatted account numbers (e.g. `04-01-97-635160-1`) into pure numeric digits (`0401976351601`).
- **Secure Logging**: Logs URLs, HTTP statuses, and verification status without ever printing `client_secret`, `access_token`, or `Authorization` headers.
- **Error Handling**: Formatted responses for `400`, `401`, `403`, `404`, `429`, and `5xx` errors with actionable remediation tips.

---

## 1. Environment Configuration

Create a `.env` file in the project root:

```env
PORT=3000
BANCO_GENERAL_BASE_URL=https://conexionbg.bgeneral.cloud
BANCO_GENERAL_CLIENT_ID=YOUR_CLIENT_ID
BANCO_GENERAL_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

> **Security Note:** Never commit `.env` or hardcode credentials in source code.

---

## 2. Supported Bank Accounts

| # | Account Name | Display Number | Normalized API Number |
|---|---|---|---|
| 1 | CURRENT A/C | `04-01-97-635160-1` | `0401976351601` |
| 2 | SAVINGS A/C | `03-71-01-149790-5` | `0371011497905` |
| 3 | SAVINGS A/C | `04-71-96-450265-4` | `0471964502654` |
| 4 | CURRENT A/C | `03-27-00-000060-0` | `0327000000600` |
| 5 | SAVINGS A/C WORKSHOP | `04-71-00-000301-0` | `0471000003010` |

---

## 3. Backend Endpoints

### Query Account Balance
- **Method:** `GET`
- **Route:** `/api/banco-general/balance/:accountNumber`
- **Example:** `GET http://localhost:3000/api/banco-general/balance/0401976351601`
- **Or with dashes:** `GET http://localhost:3000/api/banco-general/balance/04-01-97-635160-1`

### List Supported Accounts
- **Method:** `GET`
- **Route:** `/api/banco-general/accounts`

### Test Authentication
- **Method:** `GET`
- **Route:** `/api/banco-general/auth/test`

### Token Status / Reset
- **Status:** `GET /api/banco-general/token/status`
- **Clear Cache:** `POST /api/banco-general/token/clear`

---

## 4. Running the Project

```bash
# Install dependencies
npm install

# Run the test suite (validates normalization & config)
npm run test:bg

# Start the server
npm start

# Or with auto-reload (development)
npm run dev
```

---

## 5. Postman Collection

Import `postman/BancoGeneral_ConexionBG.postman_collection.json` into Postman. Set the collection variables:
- `client_id`
- `client_secret`
