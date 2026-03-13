# zkCredit
DeFi lending protocol for AI trading agents on Base.

## What It Does
- Scores agents in a 300-850 range using:
  - trusted off-chain oracle path (`CreditVerifier.submitScore`)
  - private ZK path (`ZKCreditVerifier.submitZKScore`)
- Supports hybrid stealth wallets:
  - self-custody path
  - BitGo-verified path
- Supports multi-asset collateral with quality multipliers.
- Uses 4 milestone phases (25/50/75/100) for collateral and principal release.
- Writes ENS-like metadata on-chain via `ZKCreditResolver`.
- Stores richer metadata/documents off-chain via `offchain/fileverse-client.js`.

## Contracts
- `contracts/src/CreditVerifier.sol`
  - oracle signature verification
  - score validity 7 days
  - score/tier/LTV/APR mappings
  - BitGo bonus (+25, capped to 850)
- `contracts/src/ZKCreditVerifier.sol`
  - verifies Groth16 proof
  - checks merkle root authorization (accepted root or oracle-signed root)
  - enforces nullifier/proof replay protection
  - updates `CreditVerifier` through scorer role
- `contracts/src/BitGoRegistry.sol`
  - links BitGo wallet IDs with attestation verification
- `contracts/src/StealthRegistry.sol`
  - self + BitGo stealth link paths
  - stores `loanId -> stealthAddress`
- `contracts/src/CollateralVault.sol`
  - custody for multi-asset collateral
  - debt accrual, repayments, and liquidation
- `contracts/src/LoanManager.sol`
  - quote, open loan, milestones, extension, repay, trigger default
  - optional wiring to `ZKCreditVerifier`
- `contracts/src/ZKCreditResolver.sol`
  - ENS-like node/address map
  - text records + contenthash

## Off-chain Services
- `offchain/oracle-server.js`
  - fetches Polymarket activity
  - submits oracle-signed scores
  - builds daily Poseidon Merkle roots
  - returns per-agent path elements/indices + root signature
- `offchain/agent-prover.js`
  - creates witness from own activity + oracle merkle path
  - runs `snarkjs` Groth16 proof generation locally
  - prints Solidity-ready calldata inputs
- `offchain/bitgo-client.js`
  - BitGo integration points (onboard, stealth address generation, signing)
- `offchain/fileverse-client.js`
  - profile/document/status storage helpers

## ZK Circuit
- `zk/circuits/polymarket_history.circom`
  - private inputs: proxy + trade arrays + merkle path
  - public outputs: `score`, `merkleRoot`, `nullifier`
  - includes score constraints, inclusion proof, and nullifier derivation
- Setup and usage commands: `zk/README.md`

## Deployment Order
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
- `stealth.setLoanManager(loanManager)`
- `verifier.setScorer(loanManager, true)`
- `verifier.setScorer(zkCreditVerifier, true)`
- `loanManager.setZKCreditVerifier(zkCreditVerifier)`

The Foundry deploy script is in `contracts/script/Deploy.s.sol`.

## Tests
Run:
```bash
cd contracts
forge test
```

Current coverage includes:
- oracle score submission
- BitGo linking
- self/BitGo stealth linking
- milestone loan lifecycle
- deploy-style wiring assertions
- ZK verifier submission/replay/invalid-proof cases

