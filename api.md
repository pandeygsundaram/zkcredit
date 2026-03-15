# zkCredit API Reference

This document provides a concise reference for interacting with the zkCredit protocol, including smart contracts and off-chain services.

---

## 1) Smart Contract Interfaces (On-Chain)

### Core Contracts

#### CreditVerifier
- `submitScore(address agent, address proxy, uint256 score, uint256 leverageBps, uint256 expiry, bytes signature)`
  - Stores a score for `agent` signed by the authorized oracle.
  - Score validity is 7 days from `expiry`.

- `latestRecords(address agent) -> (uint256 score, uint256 expiry, uint256 leverageBps)`
  - Returns the latest stored score and metadata for an agent.

- `setScore(address agent, uint256 score, uint256 leverageBps, uint256 expiry)`
  - Restricted to authorized scorers (e.g., `LoanManager`, `ZKCreditVerifier`).

- `isBitGoVerified(address agent) -> bool`
  - Returns whether the agent has BitGo verification.


#### ZKCreditVerifier
- `submitZKScore(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[] publicSignals, bytes rootSignature)`
  - Verifies a Groth16 proof asserting an agent’s valid score derived from historical activity.
  - Enforces nullifier uniqueness (prevents replay).
  - Updates `CreditVerifier` via scorer role.


#### LoanManager
- `getQuote(address[] collateralTokens, uint256[] collateralAmounts) -> (uint256 score, uint256 maxPrincipal, uint256 aprBps, uint256 ltvBps, uint256 tier)`
  - Computes max borrow based on agent score + collateral quality.

- `openLoan(address[] collateralTokens, uint256[] collateralAmounts, uint256 principal, bytes32 loanId, bytes stealthSignature)`
  - Opens a new loan (phase 1) and links a stealth address (self or BitGo path).

- `progressMilestone(bytes32 loanId)`
  - Moves the loan to the next phase and releases the next tranche.

- `extendMilestone(bytes32 loanId, uint256 extensionSeconds)`
  - Extends the current milestone window (max extension enforced).

- `repay(bytes32 loanId, uint256 amount)`
  - Process a repayment and updates debt / collateral.

- `triggerDefault(bytes32 loanId, string reason)`
  - Trigger a default and liquidate collateral.


#### CollateralVault
- `depositCollateral(bytes32 loanId, address token, uint256 amount)`
  - Deposits collateral for a loan (internal to `LoanManager`).

- `withdrawCollateral(bytes32 loanId, address token, uint256 amount)`
  - Withdraws unlocked collateral post-closure (internal). 

- `liquidate(bytes32 loanId, address[] tokens, uint256[] amounts)`
  - Liquidates collateral based on `LoanManager` instruction.


#### StealthRegistry
- `registerMetaAddress(address metaAddress)`
  - Registers self-custody meta-address (used for stealth wallet flows).

- `linkStealthAddress(address stealthAddress, bytes32 loanId, bytes signature)`
  - Self-custody stealth path: agent signs `loanId` to link.

- `linkStealthAddressBitGo(address stealthAddress, bytes32 loanId, bytes signature, string walletId)`
  - BitGo path: uses BitGo attestation signature.


#### BitGoRegistry
- `linkBitGoWallet(address agent, string walletId, bytes signature)`
  - Stores BitGo wallet assertions for an agent.

- `isBitGoVerified(address agent) -> bool`
  - Returns whether a wallet is BitGo-verified.


#### ZKCreditResolver
- `setText(bytes32 node, string key, string value)`
  - Sets an ENS-like text record for a node.

- `setContenthash(bytes32 node, bytes hash)`
  - Stores an IPFS/Fileverse content hash.

- `setAddr(bytes32 node, address addr)`
  - Binds a node to a blockchain address.


---

## 2) Off-Chain Services (REST)

### Oracle Server (`offchain/oracle-server.js`)

#### POST `/submit-score`
- Body:
  - `agentAddress`: wallet receiving the score
  - `proxyAddress`: source of history (proxy) used to compute score
  - `leverageBps`: leverage multiplier in basis points (e.g., 10000 == 1x)

- Returns:
  - `score` (300–850), `leverageBps`, `proofHash`, `txHash`


#### POST `/build-merkle-tree`
- Body:
  - `agents`: array of `{ agentAddress, proxyAddress }` entries

- Returns:
  - Merkle root and per-agent path (index + siblings) for ZK proof generation.


### ZK Proof Generation (`offchain/agent-prover.js`)
- Uses the generated Merkle path + private Polymarket history to create a Groth16 proof.
- Outputs Solidity calldata arrays for `submitZKScore(...)`.


---

## 3) Typical On-Chain Workflows (Quick Reference)

### A. Oracle Score Path
1. Call `/submit-score` on oracle server.
2. Oracle server submits `CreditVerifier.submitScore(...)` on-chain.
3. Verify on-chain record:
   - `cast call $CREDIT_VERIFIER "latestRecords(address)(uint256,uint256,uint256)" 0xAGENT --rpc-url $RPC`


### B. ZK Score Path
1. Build Merkle tree via `/build-merkle-tree`.
2. Generate proof with `node offchain/agent-prover.js`.
3. Call `ZKCreditVerifier.submitZKScore(...)` with proof inputs.


### C. Loan Origination
1. Get quote:
   - `LoanManager.getQuote([...tokens], [...amounts])`
2. Open loan:
   - `LoanManager.openLoan([...tokens], [...amounts], principal, loanId, stealthSignature)`
3. Advance milestones:
   - `LoanManager.progressMilestone(loanId)`


---

## 4) Key Events

- `ScoreSubmitted(address agent, uint256 score, uint256 expiry)` (CreditVerifier)
- `ZKScoreSubmitted(address agent, uint256 score)` (ZKCreditVerifier)
- `LoanOpened(bytes32 loanId, address agent, address stealthAddress, uint256 principal)` (LoanManager)
- `MilestoneProgressed(bytes32 loanId, uint8 phase)` (LoanManager)
- `LoanRepaid(bytes32 loanId, uint256 amount)` (LoanManager)
- `DefaultTriggered(bytes32 loanId, string reason)` (LoanManager)


---

## 5) Quick CLI Cheat Sheet

```bash
# Fetch latest score record
cast call $CREDIT_VERIFIER "latestRecords(address)(uint256,uint256,uint256)" 0xAGENT --rpc-url $RPC

# Get quote
cast call $LOAN_MANAGER "getQuote(address[],uint256[])(uint256,uint256,uint256,uint256,uint256)" '[TOKEN]' '[AMOUNT]' --rpc-url $RPC

# Submit ZK score (example)
cast send $ZK_CREDIT_VERIFIER "submitZKScore(uint256[2],uint256[2][2],uint256[2],uint256[],bytes)" \
  $PA $PB $PC $PUBLIC_SIGNALS $ROOT_SIGNATURE --rpc-url $RPC --private-key $PK
```
