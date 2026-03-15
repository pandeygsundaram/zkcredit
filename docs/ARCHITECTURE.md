# zkCredit Architecture

## System Overview

zkCredit is a Zero-Knowledge lending protocol designed for autonomous AI agents. It enables agents to obtain DeFi loans based on their verifiable trading performance without revealing sensitive trading strategies.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              zkCredit Protocol                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Frontend   │───▶│Oracle Server │───▶│  Smart       │                   │
│  │   (React)    │    │  (Node.js)   │    │  Contracts   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         │                   ▼                   ▼                            │
│         │           ┌──────────────┐    ┌──────────────┐                    │
│         │           │  Fileverse   │    │  Base Sepolia│                    │
│         │           │  (Storage)   │    │  Blockchain  │                    │
│         │           └──────────────┘    └──────────────┘                    │
│         │                   │                                                │
│         ▼                   ▼                                                │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │  8004scan    │    │  Polymarket  │                                       │
│  │  Registry    │    │  Data API    │                                       │
│  └──────────────┘    └──────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Frontend (React + TypeScript)

The user interface for browsing agents and viewing credit scores.

```
frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── AgentsView.tsx      # List all AI agents
│   │   │   ├── AgentDetailView.tsx # Credit score display
│   │   │   ├── LoansView.tsx       # Loan management (coming soon)
│   │   │   └── DashboardLayout.tsx # Main layout
│   │   ├── landing/
│   │   │   ├── Hero.tsx            # Landing page hero
│   │   │   └── Navbar.tsx          # Navigation
│   │   └── ui/
│   │       ├── Card.tsx            # UI components
│   │       └── Button.tsx
│   └── services/
│       └── agentApi.ts             # API client
```

### 2. Oracle Server (Node.js + Express)

The off-chain oracle that calculates credit scores and manages on-chain submissions.

```
offchain/
├── oracle-server.js      # Main server
├── fileverse-client.js   # Fileverse integration
└── bitgo-client.js       # BitGo wallet integration
```

### 3. Smart Contracts (Solidity)

On-chain contracts deployed on Base Sepolia.

```
contracts/src/
├── CreditVerifier.sol    # Oracle-signed score verification
├── ZKCreditVerifier.sol  # ZK proof verification
├── LoanManager.sol       # Loan lifecycle management
├── CollateralVault.sol   # Collateral custody
├── StealthRegistry.sol   # Privacy-preserving addresses
├── ZKCreditResolver.sol  # ENS resolver for credit data
├── Groth16Verifier.sol   # ZK-SNARK verifier
└── BitGoRegistry.sol     # BitGo wallet registry
```

---

## Credit Score Calculation

### Sharpe Ratio Method

The credit score is calculated using the **Sharpe Ratio**, a measure of risk-adjusted returns.

```
                    Mean Return - Risk-Free Rate
Sharpe Ratio = ─────────────────────────────────────
                    Standard Deviation of Returns
```

#### Calculation Flow

```
┌─────────────────┐
│ Agent Address   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Fetch Trading   │────▶│ Polymarket API  │
│ History         │     │ /trades         │
└────────┬────────┘     │ /positions      │
         │              │ /activity       │
         ▼              └─────────────────┘
┌─────────────────┐
│ Extract Returns │
│ per Trade       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │
│ Mean Return     │──────────────────┐
└────────┬────────┘                  │
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ Calculate       │         │ Risk-Free Rate  │
│ Std Deviation   │         │ (0.014% daily)  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Sharpe Ratio    │
            │ Calculation     │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Map to Tier     │
            │ A/B/C/D         │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Generate Score  │
            │ (300-900)       │
            └─────────────────┘
```

#### Tier Mapping

| Sharpe Ratio | Tier | Score Range | Description |
|--------------|------|-------------|-------------|
| > 1.5 | A | 750 - 900 | Exceptional risk-adjusted returns |
| > 0.5 | B | 650 - 749 | Above-average performance |
| > 0.0 | C | 550 - 649 | Moderate performance |
| <= 0.0 | D | 300 - 549 | Below-average or negative returns |

#### Code Implementation

```javascript
function calculateSharpeRatio(activities) {
  // Extract returns (profit/volume per activity)
  const returns = activities
    .filter(a => Number(a.volume) > 0)
    .map(a => Number(a.profit) / Number(a.volume));

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Risk-free rate (annualized ~5%, daily ~0.014%)
  const riskFreeRate = 0.00014;

  // Sharpe ratio
  return (meanReturn - riskFreeRate) / stdDev;
}
```

---

## Data Storage (Fileverse)

Agent profiles and loan documents are stored on **Fileverse**, a decentralized storage solution.

### Storage Schema

```
┌─────────────────────────────────────────┐
│           Fileverse Storage             │
├─────────────────────────────────────────┤
│                                         │
│  Agent Profile (zkcredit.agent.profile.v1)
│  ┌─────────────────────────────────────┐
│  │ {                                   │
│  │   "schema": "zkcredit.agent...",    │
│  │   "agent": "0x...",                 │
│  │   "metadata": {                     │
│  │     "score": 725,                   │
│  │     "proofHash": "0x...",           │
│  │     "issuedAt": 1710460800          │
│  │   },                                │
│  │   "createdAt": "2026-03-15T..."     │
│  │ }                                   │
│  └─────────────────────────────────────┘
│                                         │
│  Loan Documents (zkcredit.loan.documents.v1)
│  ┌─────────────────────────────────────┐
│  │ {                                   │
│  │   "schema": "zkcredit.loan...",     │
│  │   "loanId": "0x...",                │
│  │   "encryption": "aes-256-gcm",      │
│  │   "content": { ... }                │
│  │ }                                   │
│  └─────────────────────────────────────┘
│                                         │
└─────────────────────────────────────────┘
```

### CID Generation

Content is addressed using IPFS-style CIDs:
```javascript
const cid = `bafy${keccak256(payload).slice(2, 22)}`;
```

---

## Loan Lifecycle

### Loan Flow Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Agent   │     │  Oracle  │     │  Loan    │     │Collateral│
│          │     │  Server  │     │  Manager │     │  Vault   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Request     │                │                │
     │    Score       │                │                │
     │───────────────▶│                │                │
     │                │                │                │
     │                │ 2. Fetch       │                │
     │                │    History     │                │
     │                │───────────────▶│                │
     │                │                │                │
     │ 3. Score +     │                │                │
     │    Signature   │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ 4. Submit      │                │                │
     │    Collateral  │                │                │
     │────────────────────────────────────────────────▶│
     │                │                │                │
     │ 5. Open Loan   │                │                │
     │───────────────────────────────▶│                │
     │                │                │                │
     │                │                │ 6. Verify     │
     │                │                │    Score      │
     │                │◀───────────────│                │
     │                │                │                │
     │                │                │ 7. Transfer   │
     │                │                │    Collateral │
     │                │                │───────────────▶│
     │                │                │                │
     │ 8. Loan        │                │                │
     │    Opened      │                │                │
     │◀──────────────────────────────-│                │
     │                │                │                │
```

### Milestone-Based Release

Loans are released in 4 milestones:

```
┌─────────────────────────────────────────────────────────────┐
│                    Loan Timeline                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Day 0        Day 7        Day 14       Day 21              │
│     │            │            │            │                 │
│     ▼            ▼            ▼            ▼                 │
│  ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐             │
│  │ 25% │      │ 50% │      │ 75% │      │100% │             │
│  │     │      │     │      │     │      │     │             │
│  └─────┘      └─────┘      └─────┘      └─────┘             │
│                                                              │
│  Phase 1      Phase 2      Phase 3      Phase 4              │
│  Release      Release      Release      Final                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Zero-Knowledge Proofs

### ZK Circuit (Poseidon Hash)

The ZK system uses Poseidon hash for efficient proof generation:

```
┌─────────────────────────────────────────────────────────────┐
│                    ZK Credit Proof                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Private Inputs:                                             │
│  ┌───────────────────────────────────────────┐              │
│  │ proxyAddress (trading wallet)              │              │
│  │ totalVolume                                │              │
│  │ totalPnL                                   │              │
│  │ tradeCount                                 │              │
│  └───────────────────────────────────────────┘              │
│                         │                                    │
│                         ▼                                    │
│               ┌─────────────────┐                           │
│               │  Poseidon Hash  │                           │
│               └────────┬────────┘                           │
│                        │                                     │
│                        ▼                                     │
│               ┌─────────────────┐                           │
│               │   Leaf Hash     │                           │
│               └────────┬────────┘                           │
│                        │                                     │
│                        ▼                                     │
│  ┌───────────────────────────────────────────┐              │
│  │          Merkle Tree Inclusion            │              │
│  │                                           │              │
│  │    Root (public) ◄── Path Elements        │              │
│  └───────────────────────────────────────────┘              │
│                                                              │
│  Public Outputs:                                             │
│  ┌───────────────────────────────────────────┐              │
│  │ merkleRoot                                 │              │
│  │ creditScore (derived, not raw stats)       │              │
│  └───────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Merkle Tree Structure

```
                        Root
                       /    \
                     /        \
                   H1          H2
                  /  \        /  \
                H3    H4    H5    H6
               / \   / \   / \   / \
              L0 L1 L2 L3 L4 L5 L6 L7

              Leaf = Poseidon(proxy, volume, pnl, trades)
```

---

## Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Contract Relationships                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │ CreditVerifier  │◀────▶│ ZKCreditVerifier│               │
│  │                 │      │                 │               │
│  │ - submitScore() │      │ - verifyProof() │               │
│  │ - latestRecords │      │ - merkleRoot    │               │
│  └────────┬────────┘      └─────────────────┘               │
│           │                                                  │
│           │ verifies score                                   │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │   LoanManager   │                                        │
│  │                 │                                        │
│  │ - openLoan()    │                                        │
│  │ - getQuote()    │                                        │
│  │ - repayLoan()   │                                        │
│  │ - tiers[]       │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           │ manages collateral                               │
│           ▼                                                  │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │CollateralVault  │      │ StealthRegistry │               │
│  │                 │      │                 │               │
│  │ - deposit()     │      │ - registerMeta()|               │
│  │ - withdraw()    │      │ - stealthAddr   │               │
│  └─────────────────┘      └─────────────────┘               │
│                                                              │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │ Groth16Verifier │      │ZKCreditResolver │               │
│  │                 │      │                 │               │
│  │ - verifyProof() │      │ - ENS resolver  │               │
│  │ - pairing ops   │      │ - credit TXT    │               │
│  └─────────────────┘      └─────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Privacy
- Trading statistics are never revealed on-chain
- ZK proofs verify score validity without exposing data
- Stealth addresses hide loan recipient identity

### Trust Model
- Oracle server is trusted for score calculation
- On-chain verification ensures signature validity
- Merkle proofs enable batch verification

### Collateral Safety
- CollateralVault holds funds securely
- Multi-sig can be added for large loans
- Liquidation triggers on missed milestones

---

## Deployment

### Environment Setup

```bash
# Required environment variables
RPC_URL=https://sepolia.base.org
ORACLE_PRIVATE_KEY=0x...
CREDIT_VERIFIER_ADDRESS=0x...
ZK_CREDIT_VERIFIER_ADDRESS=0x...
LOAN_MANAGER_ADDRESS=0x...
API_KEY_8004=your_api_key
FILEVERSE_ENDPOINT=https://api.fileverse.io
FILEVERSE_API_KEY=your_key
```

### Docker Deployment

```bash
# Build and run
docker build -t zkcredit .
docker run -p 8787:8787 --env-file .env zkcredit
```

### Manual Deployment

```bash
# Install dependencies
npm install

# Start oracle server
node offchain/oracle-server.js

# Start frontend (development)
cd frontend && npm run dev
```

---

## Future Enhancements

1. **Multi-chain Support** - Deploy on Arbitrum, Optimism, Polygon
2. **Additional Data Sources** - DEX trading history, lending protocols
3. **Reputation NFTs** - On-chain credit history badges
4. **DAO Governance** - Community-controlled tier parameters
5. **Cross-chain Collateral** - Accept collateral from multiple chains
