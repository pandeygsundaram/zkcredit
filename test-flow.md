# Test Flow (Start -> Score -> Loan)

This runbook tests the full zkCredit flow on Base Sepolia from setup to loan approval/open.

## 1. Preflight

From repo root:

```bash
cd /mnt/d/dev/web3/projectx
```

Health check contracts first:

```bash
cd contracts
forge test
cd ..
```

If tests fail, stop and fix before live flow.

## 2. Env Setup

Root `.env` must include at least:

```bash
BASE_SEPOLIA_RPC=...
PRIVATE_KEY=...
USDC_ADDRESS=...

LOAN_MANAGER=0x90f389219b1a51CD474c05dc87b594C288a2e5e0
CREDIT_VERIFIER=0xf59c39DC0E76D002891D36af4Bc03E3b4e70B5e2
STEALTH_REGISTRY=0x55584DC11EFC4e726dDdd3Da258D8336a7d02aED
ZK_CREDIT_VERIFIER_ADDRESS=...

# simulation: score source history can be a different proxy wallet
SCORE_PROXY_ADDRESS=0xA93Fc5280d63D11e809b77432a941d64edC0958e
ORACLE_BASE_URL=http://localhost:8787
TEST_COLLATERAL_USDC=1000
TEST_PRINCIPAL_PCT=50
```

For `offchain/oracle-server.js`:

```bash
PORT=8787
RPC_URL=...
ORACLE_PRIVATE_KEY=...
CREDIT_VERIFIER_ADDRESS=...
ZK_CREDIT_VERIFIER_ADDRESS=...

# Polymarket endpoints
POLYMARKET_DATA_API=https://data-api.polymarket.com
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
POLYMARKET_TIMEOUT_MS=10000

# Optional fallback
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets
```

## 3. Start Oracle Server

```bash
node offchain/oracle-server.js
```

Expected log:

```text
oracle server listening on 8787
```

## 4. Score Generation (Oracle Path)

Submit a score for a wallet you control (`agentAddress`) using any proxy history (`proxyAddress`):

```bash
curl -X POST http://localhost:8787/submit-score \
  -H "content-type: application/json" \
  -d '{
    "agentAddress":"0xYOUR_WALLET_ADDRESS",
    "proxyAddress":"0xA93Fc5280d63D11e809b77432a941d64edC0958e",
    "leverageBps":10000
  }'
```

Expected response has:
- `score`
- `leverageBps`
- `proofHash`
- `txHash`

Confirm on-chain record exists:

```bash
cast call $CREDIT_VERIFIER "latestRecords(address)(uint256,uint256,uint256)" 0xYOUR_AGENT --rpc-url $BASE_SEPOLIA_RPC
```

## 5. Quote + Loan Approval/Open (Main Path)

Use the provided script at repo root: `test-flow.js`.

Run:

```bash
node test-flow.js
```

Expected:
- score submitted for your wallet (`agentAddress = wallet.address`) using `SCORE_PROXY_ADDRESS`
- quote succeeds
- `openLoan` tx succeeds
- `LoanOpened` is found
- `loans(loanId)` returns active phase data

## 6. Optional ZK Score Path (If You Want ZK Instead of Oracle Path)

Build root:

```bash
curl -X POST http://localhost:8787/build-merkle-tree \
  -H "content-type: application/json" \
  -d '{
    "agents":[{"agentAddress":"0xYOUR_AGENT","proxyAddress":"0xYOUR_PROXY"}]
  }'
```

Generate proof:

```bash
AGENT_ADDRESS=0xYOUR_AGENT \
PROXY_ADDRESS=0xYOUR_PROXY \
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets \
ORACLE_BASE_URL=http://localhost:8787 \
CIRCUIT_WASM=zk/build/polymarket_history_js/polymarket_history.wasm \
CIRCUIT_ZKEY=zk/build/polymarket_history_final.zkey \
node offchain/agent-prover.js
```

Submit `submitZKScore(pA,pB,pC,publicSignals,rootSignature)` to `ZKCreditVerifier`, then run `test-flow.js` again for quote/open.

## 7. Post-Open Checks

- read loan state:

```bash
cast call $LOAN_MANAGER "loans(bytes32)(address,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint256,bool,bool,bool)" 0xYOUR_LOAN_ID --rpc-url $BASE_SEPOLIA_RPC
```

- monitor events:

```bash
node monitor.js
```

## 8. Acceptance Checklist

- `forge test` passes
- `/submit-score` returns score and on-chain record is updated
- `getQuote` returns non-zero max loan
- `openLoan` succeeds and emits `LoanOpened`
- loan exists in `loans(loanId)` with expected phase/released fields
- optional: ZK path (`build-merkle-tree` -> prove -> `submitZKScore`) succeeds
