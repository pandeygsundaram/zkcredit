# zkCredit Security Guide

This document lays out the key security considerations, assumptions, and best practices for safely deploying and operating zkCredit.

---

## 1) Threat Model & Assumptions

### High-Level Goals
- Ensure only valid scores are accepted (oracle or ZK proof).
- Prevent replay attacks and double-spend of scores.
- Protect borrower collateral and enforce correct liquidation logic.
- Maintain privacy: avoid exposing raw trade histories on-chain.

### Assumptions
- The oracle signer key is trusted and properly secured.
- BitGo attestation is trusted for institutional wallet identity.
- Off-chain systems (oracle server, prover node) are run by trusted parties.


---

## 2) Smart Contract Security Controls

### Signatures & Oracle Integrity
- `CreditVerifier.submitScore` requires a valid ECDSA signature from `oracleSigner`.
- Score submissions include a `expiry` timestamp to limit window of use.
- `@openzeppelin/contracts` signature utilities are used to prevent malleability.

### ZK Proof & Replay Protection
- `ZKCreditVerifier` verifies Groth16 proofs from `polymarket_history.circom`.
- Merkle root authorization is enforced via oracle-signed root or pre-accepted roots.
- Nullifiers are recorded on-chain to prevent proof replay.

### Loan & Collateral Safety
- `LoanManager` enforces:
  - Min/max principal limits ($500 / $100k)
  - Score/tier requirements and BitGo-specific collateral boosts
  - Milestone timing (7 days + 48h grace)
  - Loan-collateral invariants on open/progress/repay

- `CollateralVault`:
  - Tracks collateral per loan.
  - Applies liquidation economics (5% keeper, 1% protocol fee).
  - Prevents under-collateralized withdrawals.

### Access Control
- `LoanManager` and `ZKCreditVerifier` are granted scorer roles in `CreditVerifier`.
- `LoanManager` is the only contract permitted to call core vault and resolver methods.


---

## 3) Off-Chain Security Best Practices

### Key Management
- Oracle and deployer private keys must be stored securely (HSM/Key vault).
- Never commit private keys to source control. `.env` is expected to be local-only.

### Oracle Server Hardening
- Run the oracle server behind a firewall that restricts access to required endpoints.
- Rate limit the `/submit-score` and `/build-merkle-tree` endpoints.

### Prover Node Privacy
- Agents should run their own prover node to prevent exposing detailed history to third parties.
- Ensure `offchain/agent-prover.js` is run in an environment where local history is protected.


---

## 4) Common Attack Vectors & Mitigations

### 1. Score Replay / Re-submission
- **Mitigation**: scores include expiry + signature; ZK path uses nullifiers.

### 2. Malicious Oracle
- **Mitigation**: oracle key is controlled by a trusted entity; score logic can be audited.

### 3. Incorrect Liquidation
- **Mitigation**: `CollateralVault` enforces minimum reserve and uses strict checks before liquidation.

### 4. Stealth Address Spoofing
- **Mitigation**: Stealth linkage requires signatures (self or BitGo attestation) and loan-specific binding.


---

## 5) Recommended Auditing & Monitoring

- **Static Analysis**: run Slither / MythX on contracts.
- **Unit Tests**: ensure `forge test` covers edge cases (score expiry, replay, default conditions).
- **Event Monitoring**: watch for unexpected `DefaultTriggered` / `LoanOpened` events.
- **Signer Rotation**: plan for oracle signer key rotation if support is added.


---

## 6) Responsible Disclosure
If you discover a security vulnerability, contact the project maintainer or repository owner privately (e.g., via GitHub Security Advisories).
