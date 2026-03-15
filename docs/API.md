# zkCredit API Documentation

## Overview

The zkCredit Oracle Server provides RESTful APIs for credit score calculation, agent management, and loan operations. The server runs on port `8787` by default.

**Base URL:** `http://localhost:8787`

---

## Endpoints

### 1. Get Agents

Fetches registered AI agents from the 8004scan registry.

```
GET /agents
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Number of agents per page |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "agent_id": "1:0x...:28700",
      "token_id": "28700",
      "chain_id": 1,
      "name": "Agent Name",
      "description": "Agent description",
      "image_url": "https://...",
      "owner_address": "0x...",
      "total_score": 45.85,
      "health_score": 65,
      "star_count": 0,
      "supported_protocols": ["MCP", "OASF"],
      "is_verified": false,
      "created_at": "2026-03-15T00:36:23Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 14186,
      "hasMore": true
    }
  }
}
```

---

### 2. Calculate Credit Score

Calculates a credit score for an agent based on their trading history using Sharpe ratio analysis.

```
POST /calculate-score
```

**Request Body:**
```json
{
  "agentAddress": "0x1234...5678",
  "proxyAddress": "0x1234...5678"
}
```

**Response:**
```json
{
  "success": true,
  "score": 725,
  "tier": "B",
  "tierName": "Good",
  "activitiesCount": 156
}
```

**Credit Score Calculation (Sharpe Ratio Method):**

The credit score is calculated using risk-adjusted returns:

```
Sharpe Ratio = (Mean Return - Risk-Free Rate) / Standard Deviation
```

| Sharpe Ratio | Tier | Score Range | Rating |
|--------------|------|-------------|--------|
| > 1.5 | A | 750 - 900 | Excellent |
| > 0.5 | B | 650 - 749 | Good |
| > 0.0 | C | 550 - 649 | Fair |
| <= 0.0 | D | 300 - 549 | Poor |

---

### 3. Submit Score (On-Chain)

Submits a verified credit score to the blockchain and stores agent profile on Fileverse.

```
POST /submit-score
```

**Request Body:**
```json
{
  "agentAddress": "0x1234...5678",
  "proxyAddress": "0x1234...5678",
  "leverageBps": 10000
}
```

**Response:**
```json
{
  "score": 725,
  "leverageBps": 10000,
  "proofHash": "0x...",
  "fileverseCid": "bafy...",
  "txHash": "0x..."
}
```

**On-Chain Actions:**
1. Fetches trading history from Polymarket
2. Calculates credit score using Sharpe ratio
3. Stores agent profile on Fileverse (decentralized storage)
4. Submits score to CreditVerifier smart contract
5. Oracle signs the score for verification

---

### 4. Get Loan Quote

Retrieves a loan quote based on collateral and credit score.

```
POST /get-quote
```

**Request Body:**
```json
{
  "agentAddress": "0x1234...5678",
  "collateralTokens": ["0xUSDC..."],
  "collateralAmounts": ["1000000000"]
}
```

**Response:**
```json
{
  "agentAddress": "0x...",
  "score": "725",
  "tier": 3,
  "tierName": "Good",
  "aprBps": "900",
  "aprPercent": "9.00%",
  "maxPrincipal": "750000000",
  "maxPrincipalFormatted": "750.00 USDC",
  "leverageBps": "10000",
  "scoreValid": true
}
```

**Tier Configuration:**
| Tier | Label | LTV | APR |
|------|-------|-----|-----|
| 5 | Exceptional | 90% | 4% |
| 4 | Excellent | 85% | 6% |
| 3 | Good | 75% | 9% |
| 2 | Fair | 60% | 14% |
| 1 | Poor | 45% | 20% |
| 0 | Very Poor | 30% | 30% |

---

### 5. Build Merkle Tree (ZK Proofs)

Builds a Merkle tree for batch agent score verification using ZK proofs.

```
POST /build-merkle-tree
```

**Request Body:**
```json
{
  "agents": [
    {
      "agentAddress": "0x1234...5678",
      "proxyAddress": "0x1234...5678"
    }
  ]
}
```

**Response:**
```json
{
  "root": "12345678901234567890",
  "rootSignature": "0x...",
  "count": 10
}
```

---

### 6. Get Merkle Proof

Retrieves the Merkle proof for a specific agent.

```
GET /merkle-proof/:agentAddress
```

**Response:**
```json
{
  "root": "12345678901234567890",
  "rootSignature": "0x...",
  "pathElements": ["123...", "456..."],
  "pathIndices": [0, 1, 0, ...],
  "stats": {
    "totalVolume": 1500000,
    "totalPnl": 25000,
    "tradeCount": 156
  },
  "proxyField": "0x..."
}
```

---

### 7. BitGo Wallet Status

Gets the status of a BitGo-managed wallet for an agent.

```
GET /bitgo/status/:agentAddress
```

**Response:**
```json
{
  "address": "0x...",
  "balance": "1.5",
  "status": "active"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 8787) | No |
| `RPC_URL` | Ethereum RPC endpoint | Yes |
| `ORACLE_PRIVATE_KEY` | Oracle signer private key | Yes |
| `CREDIT_VERIFIER_ADDRESS` | CreditVerifier contract address | Yes |
| `ZK_CREDIT_VERIFIER_ADDRESS` | ZKCreditVerifier contract address | Yes |
| `LOAN_MANAGER_ADDRESS` | LoanManager contract address | Yes |
| `API_KEY_8004` | 8004scan API key | Yes |
| `FILEVERSE_ENDPOINT` | Fileverse API endpoint | No |
| `FILEVERSE_API_KEY` | Fileverse API key | No |

---

## Rate Limits

- `/agents`: 100 requests/minute
- `/calculate-score`: 50 requests/minute
- `/submit-score`: 10 requests/minute (includes blockchain transaction)

---

## Example Usage

### Calculate Credit Score (cURL)

```bash
curl -X POST http://localhost:8787/calculate-score \
  -H "Content-Type: application/json" \
  -d '{
    "agentAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "proxyAddress": "0x1234567890abcdef1234567890abcdef12345678"
  }'
```

### Get Agents (cURL)

```bash
curl -X GET "http://localhost:8787/agents?page=1&limit=20"
```

### JavaScript/Fetch

```javascript
// Calculate credit score
const response = await fetch('http://localhost:8787/calculate-score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentAddress: '0x...',
    proxyAddress: '0x...'
  })
});

const { score, tier, tierName } = await response.json();
console.log(`Credit Score: ${score} (${tierName})`);
```
