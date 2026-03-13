# zkCredit - Lending Protocol for AI Agents

## Overview
zkCredit is a lending protocol that enables AI trading agents to borrow stablecoins against their on-chain reputation and collateral. The protocol uses zero-knowledge proofs to verify trading history from Polymarket without revealing sensitive strategies, while maintaining privacy through stealth addresses and decentralized storage.

## Core Value Proposition
- **No KYC Required**: Purely on-chain reputation-based lending
- **Privacy-Preserving**: ZK proofs verify history without exposing strategies
- **Risk-Adjusted Pricing**: Better collateral terms for high-quality agents
- **Chain Agnostic**: Built on Base with cross-chain data verification

---

## Architecture

### Tech Stack
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **L2 Blockchain** | Base (Sepolia → Mainnet) | Low-cost, fast finality |
| **Identity** | ENS (off-chain) | Agent name → address mapping |
| **Stealth Wallets** | BitGo MPC/TSS | Private transaction addresses |
| **Decentralized Storage** | Fileverse | Metadata, proofs, loan documents |
| **ZK Proving** | Axiom V2 | Verify Polygon history on Base |
| **Collateral Assets** | USDC, ETH, BTC, SOL | Multi-asset collateral support |

### System Flow
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT INTERFACE                          │
│              (Web App / SDK / Trading Bot)                      │
└─────────────────────────┬───────────────────────────────────────┘
│
┌─────────────────────────▼───────────────────────────────────────┐
│                     BITGO STEALTH LAYER                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  MPC Wallet │───→│   TSS Key   │───→│ Stealth Address Gen │ │
│  │  Creation   │    │  Generation │    │  (Per-loan unique)  │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
│
┌─────────────────────────▼───────────────────────────────────────┐
│                     ZK PROOF GENERATION                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ Axiom Query │───→│ Polygon     │───→│ ZK Proof (History)  │ │
│  │  Request    │    │  State      │    │  + Asset Holdings   │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
│
┌─────────────────────────▼───────────────────────────────────────┐
│                    BASE SMART CONTRACTS                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Credit    │───→│    Loan     │───→│  Collateral Vault   │ │
│  │  Verifier   │    │   Manager   │    │   (Multi-asset)     │ │
│  │ (Score 300- │    │ (Quotes &   │    │  (Milestone-based)  │ │
│  │    850)     │    │  Lifecycle) │    │                     │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                     ┌──────▼──────┐                            │
│                     │ ENS Resolver│                            │
│                     │ (Off-chain  │                            │
│                     │  mapping)   │                            │
│                     └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
│
┌─────────────────────────▼───────────────────────────────────────┐
│                    FILEVERSE STORAGE                            │
│  • Agent metadata (encrypted)                                   │
│  • ZK proof artifacts (public)                                  │
│  • Loan documents (threshold encrypted)                         │
│  • BitGo key shards (Shamir secret sharing)                     │
└─────────────────────────────────────────────────────────────────┘

---

## Risk Score System (300-850)

### Score Calculation
| Factor | Weight | Source |
|--------|--------|--------|
| Trading Volume (90d) | 15% | Polymarket on-chain |
| Profit/Loss | 25% | Realized + Unrealized |
| Consistency (Sharpe) | 20% | Return volatility |
| Experience | 15% | Days active |
| Asset Holdings Quality | 20% | ETH/BTC/SOL vs altcoins |
| Repayment History | 5% | Previous zkCredit loans |

### Score Tiers

| Tier | Score Range | Max LTV | Interest APR | Leverage Terms |
|------|-------------|---------|--------------|----------------|
| **Exceptional** | 800-850 | 90% | 4% | Premium: $1000 loan → $800 collateral (20% discount) |
| **Excellent** | 740-799 | 85% | 6% | Good: $1000 loan → $850 collateral |
| **Good** | 670-739 | 75% | 9% | Standard: $1000 loan → $1000 collateral |
| **Fair** | 580-669 | 60% | 14% | Caution: $1000 loan → $1200 collateral |
| **Poor** | 500-579 | 45% | 20% | High risk: $1000 loan → $1500 collateral |
| **Very Poor** | 300-499 | 30% | 30% | Restricted: Small loans only |

### Asset-Based Leverage Boost

Agents holding quality assets receive collateral discounts:

| Asset Type | Volatility | Leverage Multiplier | Example |
|------------|-----------|---------------------|---------|
| ETH, BTC, stables | Low | 1.2x (20% discount) | $1000 collateral covers $1200 loan |
| SOL, MATIC, ARB | Medium | 1.0x (standard) | $1000 collateral covers $1000 loan |
| Altcoins | High | 0.8x (25% premium) | $1000 collateral covers $800 loan |

**Formula:** `Effective Collateral = Asset Value × Quality Multiplier × Score Tier Multiplier`

---

## Milestone-Based Collateral System

### Structure
Instead of 100% upfront collateral, agents collateralize in tranches tied to loan utilization:

| Milestone | Collateral Required | Loan Released | Trigger |
|-----------|---------------------|---------------|---------|
| **Phase 1** | 25% | 25% of total | Loan origination |
| **Phase 2** | +25% (50% total) | +25% (50% total) | 7 days no default + positive P&L |
| **Phase 3** | +25% (75% total) | +25% (75% total) | 14 days no default + score maintained |
| **Phase 4** | +25% (100% total) | +25% (100% total) | 21 days no default + tier upgrade |

### Default Handling

| Scenario | Action | Consequence |
|----------|--------|-------------|
| **Missed milestone collateral** | Liquidate released portion + accrued | Score -100 points, tier downgrade |
| **Price drop below threshold** | Keeper liquidation | 5% keeper reward, 1% protocol fee |
| **Voluntary abandonment** | Full liquidation after 48h grace | Blacklist, score reset to 300 |
| **Underwater (collateral < debt)** | Full liquidation + bad debt | Lender absorbs loss, agent blacklisted |

---

## User Flow

### 1. Onboarding
Agent → Connect wallet → BitGo MPC wallet created → ENS name registered

### 2. Credit Assessment
Agent provides Polymarket proxy address → Axiom queries 90d history
→ ZK proof generated → CreditVerifier calculates score (300-850)
→ Tier assigned → Quote generated

### 3. Loan Origination
Agent selects collateral assets → Milestone structure proposed
→ Agent deposits Phase 1 collateral → Stealth address generated
→ Phase 1 loan released to stealth address → Fileverse documents created

### 4. Active Management
Agent trades with loan capital → Keeper monitors collateral ratios
→ Milestones unlocked based on performance → ENS records updated

### 5. Closure
Agent repays → Collateral returned → Score updated (+points for good repayment)
→ OR Liquidation triggered → Collateral seized → Default recorded

---

## Data Storage (Fileverse)

| Content | Encryption | Access Control | TTL |
|---------|-----------|----------------|-----|
| Agent profile (BitGo ID, ENS) | AES-256 | Agent + Protocol | Permanent |
| ZK proof artifacts | None | Public | Permanent |
| Trade history cache | Proxy re-encryption | Agent + Protocol | 90 days |
| Loan documents | Threshold encryption | Agent + Lender + Protocol | Loan duration + 7 years |
| BitGo key shards | Shamir (3-of-5) | MPC parties only | Permanent |

---

## Integration Points

| External Service | Integration | Data Flow |
|-----------------|-------------|-----------|
| **BitGo** | MPC wallet creation, TSS signing | Agent onboarding, transaction signing |
| **Axiom** | ZK proof generation | Polygon state → Base verification |
| **Fileverse** | IPFS storage, threshold encryption | Document persistence, versioning |
| **ENS** | Off-chain resolver | Name ↔ Address mapping, text records |
| **Polymarket** | Subgraph queries | Trade history, P&L calculation |
| **Base** | Core contracts | All protocol logic, state management |

---

## Risk Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Score range | 300-850 | FICO-compatible scale |
| Min loan | $500 | Gas efficiency |
| Max loan (Tier 1) | $100,000 | Concentration risk |
| Liquidation threshold | 105% | 5% buffer for volatility |
| Keeper reward | 5% | Competitive incentive |
| Protocol fee | 1% | Sustainability |
| Grace period | 48 hours | Human/bot error allowance |
| Score validity | 7 days | Force refresh for active traders |

---

## Revenue Model

| Source | Rate | Recipient |
|--------|------|-----------|
| Origination fee | 0.5% | Protocol treasury |
| Interest spread | Variable | Lenders (80%), Protocol (20%) |
| Liquidation fee | 1% | Protocol treasury |
| Milestone extension | 0.1% per day | Protocol treasury |

---

## Future Extensions

1. **Cross-chain collateral**: Accept collateral on Ethereum, Arbitrum, Optimism
2. **AI agent marketplace**: Lenders can browse agent profiles and bid on rates
3. **Insurance pool**: Stakers cover bad debt for yield share
4. **Governance token**: Decentralized parameter adjustment
5. **Real-world assets**: Tokenized treasuries as collateral
