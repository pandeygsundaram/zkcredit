# zkCredit Technical Overview

This document captures the high-level architecture and key technical concepts behind zkCredit.

---

## 1) System Architecture

zkCredit is a hybrid on-chain/off-chain lending protocol focused on scoring AI trading agents. It blends:

- **Trusted oracle scoring** (off-chain scoring service signs on-chain scores)
- **Privacy-preserving ZK scoring** (agents generate proofs over their own history)
- **Hybrid wallet support** (self-custody + BitGo institutional wallets)
- **Milestone-based loan disbursement** with collateral tranching
- **ENS-like metadata storage** (on-chain resolver + off-chain Fileverse storage)


### Key Components

1. **Smart Contracts (Solidity)**
   - **CreditVerifier**: stores/scores and enforces score validity, tier mapping, and BitGo bonuses.
   - **ZKCreditVerifier**: validates Groth16 proofs and writes scores into `CreditVerifier`.
   - **LoanManager**: calculates quotes, originates loans, handles milestones, repayment, and defaults.
   - **CollateralVault**: custody for multi-asset collateral; enforces liquidation economics.
   - **StealthRegistry**: manages stealth wallet linkage for self/BitGo paths.
   - **BitGoRegistry**: records BitGo attestation status.
   - **ZKCreditResolver**: ENS-like resolver for score/tier/loan metadata + Fileverse contenthash.

2. **Off-Chain Services**
   - **oracle-server.js**: computes scores (Polymarket activity), signs payloads, pushes on-chain scores, builds Merkle roots.
   - **agent-prover.js**: generates Groth16 proof using `snarkjs` and local circuit build.
   - **fileverse-client.js**: stores documents and metadata in Fileverse, updates resolver contenthash.
   - **bitgo-client.js / stealth-generator.js**: manage BitGo integration and stealth address generation.

3. **ZK Circuit**
   - Circuit: `zk/circuits/polymarket_history.circom`
   - Private inputs: agent proxy trade history + Merkle path
   - Public outputs: `score`, `merkleRoot`, `nullifier`
   - Nullifier prevents proof replay; root is authorized via oracle signature or pre-approved roots.


---

## 2) Scoring & Tiers

### Score Range
- Score range: **300–850** (aligned with common credit scoring conventions)

### Score Sources
- **Oracle path**: off-chain scoring service computes score and submits signed payload to `CreditVerifier`.
- **ZK path**: agent generates a Groth16 proof over their history; `ZKCreditVerifier` validates and sets score.

### Score Validation
- Scores expire after **7 days**.
- On-chain score is stored with `expiry` timestamp.

### Tier & Financial Parameters
- Score maps to tiers (e.g., Tier 1–5).
- Each tier maps to:
  - Loan-to-value (LTV)
  - APR
  - Milestone behavior (collateral requirements, loan caps)

- **BitGo bonus:** if agent is BitGo verified, score gets a +25 bump (capped at 850).


---

## 3) Loan Lifecycle

### Quote Phase
- Agent calls `LoanManager.getQuote(...)`.
- Quote calculation uses:
  - Agent score + tier
  - Collateral asset quality multipliers
  - Loan caps (min $500, max $100k)

### Origination / Milestone Phases
- Loan is minted with **4 phases** (25/50/75/100).
- Each phase requires:
  - Collateral deposit proportionate to required collateralization
  - Interest accrual on disbursed principal

### Progression & Extensions
- Default cadence: **7 days per milestone** + **48h grace**.
- Milestone extension is allowed for a bounded window (e.g., up to 7 days).

### Repayment & Close
- Borrower repays via `LoanManager.repay(...)`.
- Full repayment triggers:
  - Collateral return
  - Score update (repayment bonus applied via `CreditVerifier`)
  - Resolver update (`zkcredit.activeLoan=false`)

### Default & Liquidation
- Default triggers on:
  - Missed milestone beyond grace window, or
  - Collateral falling below released principal (liquidation threshold ~105%).

- Liquidation distribution:
  - Keeper reward: 5%
  - Protocol fee: 1%


---

## 4) ZK Proofing & Merkle Workflow

### Merkle Root Generation
- Oracle server builds a daily Poseidon Merkle root of agent history commitments.
- Each agent receives a Merkle path (index + siblings) for their record.

### Proof Generation
- Agent uses `offchain/agent-prover.js`:
  1. Loads local proxy transaction history (private input)
  2. Combines with Merkle path from oracle server
  3. Generates Groth16 proof using `snarkjs` against `polymarket_history.wasm` and `polymarket_history_final.zkey`

### On-Chain Verification
- `ZKCreditVerifier.submitZKScore(...)` accepts:
  - Groth16 proof (pA, pB, pC)
  - `publicSignals` (score, merkleRoot, nullifier, etc.)
  - `rootSignature` (oracle-signed root)

- The verifier checks:
  - Proof validity
  - Root authorization (oracle signature or pre-approved roots)
  - Nullifier uniqueness (prevents replay)


---

## 5) Development & Tooling

### Foundry
- Build: `forge build`
- Test: `forge test`

### Off-chain Node
- Oracle server: `node offchain/oracle-server.js`
- Prover: `node offchain/agent-prover.js`

### Frontend (Vite/React)
- Start dev server: `cd frontend && npm install && npm run dev`


---

## 6) Deployment Order

1. `BitGoRegistry(bitGoVerifier)`
2. `CreditVerifier(oracleSigner, bitGoRegistry)`
3. `ZKCreditResolver()`
4. `StealthRegistry(bitGoRegistry)`
5. `CollateralVault(usdc)`
6. `LoanManager(verifier, vault, stealthRegistry, bitGoRegistry, resolver)`
7. `ZKCreditVerifier(groth16Verifier, verifier, oracleSigner)`

Then wire:
- `vault.setLoanManager(loanManager)`
- `resolver.setController(loanManager, true)`
- `stealthRegistry.setLoanManager(loanManager)`
- `verifier.setScorer(loanManager, true)`
- `verifier.setScorer(zkCreditVerifier, true)`
- `loanManager.setZKCreditVerifier(zkCreditVerifier)`
