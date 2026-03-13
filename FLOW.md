# zkCredit Smart Contract Flow

## Contracts
- `CreditVerifier`: score + leverage from Axiom-style proofs.
- `BitGoRegistry`: BitGo wallet registration and stealth address attestations.
- `CollateralVault`: multi-asset collateral custody, tranche release, repay, liquidation.
- `LoanManager`: quote, open loan, milestone progression, repayment/default lifecycle.
- `ZKCreditResolver`: UI-facing profile records.

## Deployment Order
1. Deploy `CreditVerifier`.
2. Deploy `CollateralVault(USDC)`.
3. Deploy `BitGoRegistry(bitGoVerifier)`.
4. Deploy `ZKCreditResolver`.
5. Deploy `LoanManager(verifier, vault, bitgo, resolver)`.
6. Wire:
- `vault.setLoanManager(loanManager)`
- `resolver.setController(loanManager, true)`
- `bitgo.setLoanManager(loanManager)`
- `verifier.setAxiomQueryAddress(axiomQuery)`

## Agent Onboarding
1. Off-chain KYC/MPC setup with BitGo.
2. Agent gets `walletId` and BitGo signature.
3. Agent calls `BitGoRegistry.registerWallet(walletId, signature)`.

## Credit Scoring
1. Agent calls `CreditVerifier.verifyAndScore(proof, inputs)`.
2. Contract verifies proof (placeholder hook), prevents proof replay.
3. Score (300-850), tier, leverage are stored for the agent.

## Quote
1. Agent calls `LoanManager.getQuote(tokens, amounts)`.
2. Effective collateral is calculated using token quality multipliers.
3. Tier-based LTV/APR and leverage produce `maxPrincipal`.

## Open Loan
1. Agent calls `LoanManager.openLoan(tokens, amounts, totalPrincipal, stealthAddress, bitGoAttestation)`.
2. Manager checks active loan, wallet presence, score validity, quote bounds.
3. Manager derives `loanId`.
4. Manager calls `BitGoRegistry.linkStealthAddressFor(agent, loanId, stealthAddress, attestation)`.
5. Only phase-1 collateral/principal (25% + rounding) is posted/released.
6. Loan targets are stored for phases 2-4.
7. Resolver updates `zkcredit.activeLoan=true`.

## Milestones
1. Agent calls `progressMilestone(loanId)` each phase.
2. Time gates: `>= 7 days` and `<= 7 days + 48h grace`.
3. Additional per-token collateral is pulled.
4. Next principal tranche is released.
5. Phase and accounting are updated.

## Repayment
1. Borrower pays via `LoanManager.repay(loanId, amount)`.
2. Vault accrues interest and checks full repayment.
3. On full repayment, all collateral tokens are returned and loan closes.
4. Resolver sets `zkcredit.activeLoan=false`.

## Liquidation (Keeper)
1. Anyone calls `CollateralVault.liquidate(loanId)` if ratio < `10500`.
2. Keeper receives 5% reward, protocol gets 1% fee.
3. Vault calls `LoanManager.recordDefault(loanId)`.
4. Loan is marked liquidated/inactive.
