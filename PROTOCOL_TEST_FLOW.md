# zkCredit Test Flow

This guide is the recommended order to verify the full protocol:
- core zkCredit lending flow
- ZK score verification flow
- off-chain oracle/prover integration

## 0. Prerequisites
- Foundry installed (`forge`, `anvil`)
- Node.js installed
- `snarkjs` + `circom` installed for ZK flow
- Repo root: `/mnt/d/dev/web3/projectx`

## 1. Run Contract Test Suite First (Fast Health Check)
```bash
cd contracts
forge test
```

Expected:
- all suites pass (BitGo, StealthRegistry, CreditVerifier, LoanFlow, ZKCreditVerifier, DeployWiring)

If this fails, stop and fix before off-chain testing.

## 2. Validate Deploy-Wiring Shape
Already covered by:
- `contracts/test/DeployWiring.integration.t.sol`

Manual check target:
- deploy order and wiring in `contracts/script/Deploy.s.sol`
- `LoanManager` linked to `ZKCreditVerifier`
- scorer role granted to `ZKCreditVerifier` in `CreditVerifier`

## 3. Validate Core Lending Flow (Non-ZK Path)
Covered by:
- `contracts/test/LoanFlow.integration.t.sol`

What to verify in results:
- score submission succeeds
- self-custody loan open succeeds
- BitGo loan open succeeds
- milestone progression works
- repayment closes loan
- resolver text fields are updated

## 4. Validate ZK Contract Logic (On-Chain)
Covered by:
- `contracts/test/ZKCreditVerifier.t.sol`

What is tested:
- valid `submitZKScore` with oracle-signed root
- valid `submitZKScore` with accepted root mapping
- reused nullifier rejected
- invalid proof rejected

## 5. Build ZK Artifacts (Circuit + Verifier)
Use:
- `zk/circuits/polymarket_history.circom`
- `zk/README.md`

Follow the commands in `zk/README.md` to generate:
- WASM witness generator
- `.zkey`
- Solidity Groth16 verifier contract

Without these artifacts, you cannot run a live proof submission.

## 6. Start Local Chain + Deploy
Terminal A:
```bash
anvil
```

Terminal B:
```bash
cd contracts
cp .env.example .env 2>/dev/null || true
```

Set required env values (at least):
- `PRIVATE_KEY`
- `USDC_ADDRESS`
- `ORACLE_SIGNER`
- `BITGO_VERIFIER`
- `GROTH16_VERIFIER`

Then deploy:
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url http://127.0.0.1:8545 --broadcast
```

## 7. Start Oracle Server (Off-Chain)
From repo root, set env:
- `RPC_URL`
- `ORACLE_PRIVATE_KEY`
- `CREDIT_VERIFIER_ADDRESS`
- `ZK_CREDIT_VERIFIER_ADDRESS`
- optional `POLYMARKET_SUBGRAPH`

Run:
```bash
node offchain/oracle-server.js
```

Quick checks:
- `POST /build-merkle-tree`
- `GET /merkle-proof/:agentAddress`
- `POST /submit-score`

## 8. Build Daily Merkle Root
Call:
```bash
curl -X POST http://localhost:8787/build-merkle-tree \
  -H "content-type: application/json" \
  -d '{"agents":[{"agentAddress":"0xAGENT","proxyAddress":"0xPROXY"}]}'
```

Expected response includes:
- `root`
- `rootSignature`

## 9. Generate Agent ZK Proof Locally
Run prover:
```bash
AGENT_ADDRESS=0xAGENT \
PROXY_ADDRESS=0xPROXY \
POLYMARKET_SUBGRAPH=https://api.thegraph.com/subgraphs/name/polymarket/matic-markets \
ORACLE_BASE_URL=http://localhost:8787 \
CIRCUIT_WASM=zk/build/polymarket_history_js/polymarket_history.wasm \
CIRCUIT_ZKEY=zk/build/polymarket_history_final.zkey \
node offchain/agent-prover.js
```

Expected output includes:
- `solidityCall.pA`
- `solidityCall.pB`
- `solidityCall.pC`
- `solidityCall.publicSignals`
- `rootSignature`

## 10. Submit ZK Score On-Chain
Using your script/app/console:
- call `ZKCreditVerifier.submitZKScore(pA, pB, pC, publicSignals, rootSignature)`

Expected:
- tx success
- `ZKScoreSubmitted` event emitted
- `CreditVerifier.latestRecords(agent)` updated with score

## 11. Open Loan Using ZK-Updated Score
Use normal path:
- `LoanManager.getQuote(...)`
- `LoanManager.openLoan(...)`

Then verify:
- phase-1 tranche released to stealth address
- resolver updated (`zkcredit.score`, `zkcredit.tier`, `zkcredit.activeLoan`)

## 12. Complete Lifecycle Checks
Run through:
1. `progressMilestone(...)` across phases
2. `repay(...)` full closure path
3. separate run for default/liquidation path:
   - miss milestone or force underwater
   - call `triggerDefault(...)`

Expected:
- repayment path applies bonus
- default path applies penalty + liquidation accounting

## 13. Final Acceptance Checklist
- All Foundry tests green
- ZK proof generation works with your built artifacts
- ZK score submission updates `CreditVerifier`
- Loan flow works with that score
- Resolver and Fileverse hooks are exercised
- No Axiom dependency remains in runtime flow

