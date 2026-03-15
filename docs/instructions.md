# zkCredit Instructions

This guide walks through setup, running tests, and executing the core zkCredit flows.

---

## 1) Prerequisites

- Node.js (>= 18)
- npm / yarn
- Foundry (`forge`, `cast`, `anvil`) installed and on `PATH`
- Git


## 2) Setup

### 2.1 Clone & Install

```bash
git clone https://github.com/pandeygsundaram/zkcredit.git
cd zkcredit
```

### 2.2 Install Dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2.3 Configure Environment

Copy `.env.example` (if present) or create `.env` in the repo root.

At minimum, set:
- `BASE_SEPOLIA_RPC` (or `RPC_URL`)
- `PRIVATE_KEY` (deployer/oracle key)
- `USDC_ADDRESS` (USDC on the target network)

For the oracle server, add:
- `ORACLE_PRIVATE_KEY`
- `CREDIT_VERIFIER_ADDRESS`
- `ZK_CREDIT_VERIFIER_ADDRESS`
- `POLYMARKET_*` endpoints


---

## 3) Building & Testing

### 3.1 Compile & Run Unit Tests

```bash
cd contracts
forge build
forge test
```

### 3.2 Lint / Format

```bash
cd contracts
forge fmt
```

---

## 4) Running the Oracle Server

Start the oracle server (default port 8787):

```bash
node offchain/oracle-server.js
```

Verify it is running:

```bash
curl http://localhost:8787/health
```


---

## 5) Running a Full Test Flow

### 5.1 Configure .env

The `test-flow.md` document already contains a working `.env` template. Ensure values are filled:
- `LOAN_MANAGER`, `CREDIT_VERIFIER`, `STEALTH_REGISTRY` (deployed addresses)
- `SCORE_PROXY_ADDRESS` (for score generation)
- `TEST_COLLATERAL_USDC`, `TEST_PRINCIPAL_PCT`

### 5.2 Start the Oracle Server

```bash
node offchain/oracle-server.js
```

### 5.3 Run the End-to-End Script

```bash
node test-flow.js
```

Expected outcomes:
- Score is submitted on-chain.
- `getQuote` returns valid loan parameters.
- `openLoan` transaction succeeds.


---

## 6) ZK Score Path (Optional)

### 6.1 Build Merkle Tree

```bash
curl -X POST http://localhost:8787/build-merkle-tree \
  -H "content-type: application/json" \
  -d '{
    "agents":[{"agentAddress":"0xYOUR_AGENT","proxyAddress":"0xYOUR_PROXY"}]
  }'
```

### 6.2 Generate Proof

```bash
AGENT_ADDRESS=0xYOUR_AGENT \
PROXY_ADDRESS=0xYOUR_PROXY \
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets \
ORACLE_BASE_URL=http://localhost:8787 \
CIRCUIT_WASM=zk/build/polymarket_history_js/polymarket_history.wasm \
CIRCUIT_ZKEY=zk/build/polymarket_history_final.zkey \
node offchain/agent-prover.js
```

### 6.3 Submit Proof

The prover outputs Solidity-ready calldata (`pA`, `pB`, `pC`, `publicSignals`, `rootSignature`).

Call:

```bash
cast send $ZK_CREDIT_VERIFIER \ 
  "submitZKScore(uint256[2],uint256[2][2],uint256[2],uint256[],bytes)" \
  $PA $PB $PC $PUBLIC_SIGNALS $ROOT_SIGNATURE --rpc-url $RPC --private-key $PK
```


---

## 7) Frontend (Optional)

The frontend is a Vite app in `frontend/`.

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to view the UI.


---

## 8) Common Troubleshooting

### 8.1 `forge test` fails
- Confirm `.env` values are correct.
- Ensure Foundry is installed and initialized.
- Run `forge clean` and `forge test` again.

### 8.2 Oracle server fails to start
- Validate `ORACLE_PRIVATE_KEY` and `RPC_URL` in `.env`.
- Check that the port is available (default 8787).

### 8.3 Proof generation errors
- Ensure `snarkjs` is installed (npm package dependency).
- Verify circuit artifacts exist at `zk/build/polymarket_history*`.
- Confirm `POLYMARKET_SUBGRAPH` is reachable.
