# zkCredit Final Flow

## Overview
zkCredit is a lending protocol for AI trading agents that combines:
- Off-chain credit scoring (trusted oracle)
- Hybrid wallet support:
  - Self-custody stealth wallets (retail path)
  - BitGo-verified stealth wallets (institutional path)
- Multi-asset collateral with milestone-based loan release
- ENS-like on-chain metadata + Fileverse off-chain records

## On-Chain Components
- `CreditVerifier.sol`
  - Stores score records (300-850)
  - Verifies oracle ECDSA signatures in `submitScore(...)`
  - Score validity: 7 days
  - Tier mapping + LTV/APR mapping
  - Applies BitGo bonus (+25, capped at 850)
- `BitGoRegistry.sol`
  - Links BitGo wallet IDs via BitGo attestation
  - Tracks `isBitGoVerified(agent)`
  - Verifies BitGo stealth attestations for loan linkage
- `StealthRegistry.sol`
  - Self path: meta-address registration + local stealth proofs
  - BitGo path: BitGo-attested stealth linkage
  - Stores `loanId -> stealthAddress`
- `LoanManager.sol`
  - Quote generation from score + collateral quality
  - Loan origination (phase-1 only)
  - Milestone progression and tranche release
  - Repayment, extension, and default trigger
  - Hybrid wallet decision logic (self vs BitGo)
- `CollateralVault.sol`
  - Multi-asset collateral custody
  - Tranche release to stealth address
  - Debt accrual + repayment processing
  - Liquidation at 105% threshold
  - 5% keeper reward, 1% protocol fee
- `ZKCreditResolver.sol`
  - ENS-like node registration and resolution
  - Text records (score, tier, active loan)
  - Contenthash storage for Fileverse CID

## Off-Chain Components
- `offchain/oracle-server.js`
  - Pulls Polymarket activity (subgraph)
  - Computes score (300-850)
  - Signs score payload with oracle key
  - Calls `CreditVerifier.submitScore(...)`
  - Stores score metadata to Fileverse client
  - Exposes BitGo status endpoint
- `offchain/bitgo-client.js`
  - Handles BitGo onboarding/KYC flow integration points
  - Generates BitGo stealth address + attestation payload
  - Placeholder TSS signing integration function
- `offchain/stealth-generator.js`
  - Self-custody key generation and stealth signing helper
- `offchain/fileverse-client.js`
  - Stores agent profiles and loan documents (versioned)
  - Updates ENS resolver contenthash

## Deployment Order
1. `BitGoRegistry(bitGoVerifier)`
2. `CreditVerifier(oracleSigner, bitGoRegistry)`
3. `ZKCreditResolver()`
4. `StealthRegistry(bitGoRegistry)`
5. `CollateralVault(usdc)`
6. `LoanManager(verifier, vault, stealthRegistry, bitGoRegistry, resolver)`

Then wire:
- `vault.setLoanManager(loanManager)`
- `resolver.setController(loanManager, true)`
- `stealthRegistry.setLoanManager(loanManager)`
- `verifier.setScorer(loanManager, true)`

## Runtime Flow

### 1. Agent Onboarding
- Self-custody path:
  - Agent generates spending key locally
  - Calls `StealthRegistry.registerMetaAddress(...)`
- BitGo path (institutional):
  - Agent completes BitGo KYC off-chain
  - Agent receives wallet attestation
  - Calls `BitGoRegistry.linkBitGoWallet(walletId, signature)`

### 2. Score Submission (Oracle)
- Oracle server fetches Polymarket history for agent proxy
- Computes score + leverage
- Builds proof hash and signs message
- Calls `CreditVerifier.submitScore(...)`
- If agent is BitGo-verified, contract adds +25 score bonus (max 850)

### 3. Quote
- Agent calls `LoanManager.getQuote(tokens, amounts)`
- Manager checks score validity
- Effective collateral is computed using asset quality multipliers
- Tier => LTV/APR, then max principal is returned

### 4. Loan Origination
- Agent calls `LoanManager.openLoan(...)`
- Common checks:
  - no active loan
  - min loan >= $500
  - principal below max and <= $100,000
- Tier hardening:
  - If tier >= 4 and agent is NOT BitGo-verified, extra collateral requirement is enforced
- Stealth linkage:
  - BitGo verified -> `linkStealthAddressBitGoFor(...)`
  - Otherwise -> `linkStealthAddressFor(...)` using self signature
- Phase-1 execution:
  - 25% collateral posted
  - 25% principal released to stealth address
- Resolver updates:
  - node registration
  - `zkcredit.score`, `zkcredit.tier`, `zkcredit.activeLoan=true`

### 5. Milestones (Phases 2-4)
- Agent calls `progressMilestone(loanId)` every phase window
- Timing: each 7 days with 48h grace
- Additional collateral is pulled, next tranche is released
- `extendMilestone(...)` allows bounded extension (up to 7 days)

### 6. Repayment
- Borrower repays via `LoanManager.repay(...)`
- Vault applies repayment against accrued debt
- On full repayment:
  - collateral returned
  - loan closed
  - repayment bonus applied in verifier
  - resolver updates `activeLoan=false`

### 7. Default / Liquidation
- Default can be triggered if:
  - milestone missed beyond grace, or
  - collateral value falls below released principal
- `LoanManager.triggerDefault(...)` -> `CollateralVault.liquidate(...)`
- Vault distribution:
  - keeper reward: 5%
  - protocol fee: 1%
- Credit penalty applied in verifier
- Loan marked inactive/liquidated

## Key Parameters
- Score range: 300-850
- Score validity: 7 days
- Min loan: $500
- Max loan: $100,000
- Milestones: 4 phases (25/50/75/100)
- Milestone interval: 7 days
- Grace period: 48 hours
- Liquidation threshold: 105%
- Keeper reward: 5%
- Protocol fee: 1%

## Current Test-Covered Paths
- Oracle-signed score submission
- BitGo wallet linking
- Self-custody stealth linking
- BitGo stealth linking
- Loan opening (self + BitGo)
- Milestone progression
- Full repayment flow
- Resolver ENS/text updates during loan lifecycle
