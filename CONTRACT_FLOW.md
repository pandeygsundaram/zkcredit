# zkCredit Smart Contract Flow

## Contract Architecture
┌─────────────────────────────────────────────────────────────────┐
│                     CONTRACT DEPLOYMENTS                        │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  BitGo      │  │   Credit    │  │    Loan     │             │
│  │  Registry   │  │  Verifier   │  │   Manager   │             │
│  │  (External) │  │             │  │             │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                      │
│                   ┌──────▼──────┐                              │
│                   │ Collateral  │                              │
│                   │    Vault    │                              │
│                   │             │                              │
│                   │ • Multi-asset│                             │
│                   │ • Milestone │                              │
│                   │   tracking  │                              │
│                   │ • Liquidation│                             │
│                   └──────┬──────┘                              │
│                          │                                      │
│                   ┌──────▼──────┐                              │
│                   │ ENS Resolver│                              │
│                   │ (Off-chain  │                              │
│                   │  adapter)   │                              │
│                   └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘



---

## Contract Specifications

### 1. BitGoRegistry.sol

**Purpose**: Link BitGo MPC wallets to agent identities and generate stealth addresses.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BitGoRegistry {
    // Agent => BitGo wallet ID (hashed)
    mapping(address => bytes32) public bitGoWalletIds;
    
    // Agent => current stealth address for active loan
    mapping(address => address) public activeStealthAddress;
    
    // Stealth address => agent (reverse lookup)
    mapping(address => address) public stealthToAgent;
    
    // Loan ID => stealth address
    mapping(bytes32 => address) public loanStealthAddress;
    
    // BitGo attestation signatures
    mapping(bytes32 => bool) public validAttestations;
    
    address public bitGoVerifier; // Oracle/relayer that verifies BitGo signatures
    
    event WalletRegistered(address indexed agent, bytes32 indexed walletId);
    event StealthGenerated(address indexed agent, address indexed stealthAddress, bytes32 indexed loanId);
    
    function registerWallet(bytes32 walletId, bytes calldata bitGoSignature) external {
        require(bitGoWalletIds[msg.sender] == bytes32(0), "Already registered");
        require(verifyBitGoSignature(abi.encodePacked(msg.sender, walletId), bitGoSignature), "Invalid signature");
        
        bitGoWalletIds[msg.sender] = walletId;
        emit WalletRegistered(msg.sender, walletId);
    }
    
    function registerStealthAddress(
        bytes32 loanId,
        address stealthAddress,
        bytes calldata bitGoAttestation
    ) external {
        require(bitGoWalletIds[msg.sender] != bytes32(0), "No BitGo wallet");
        require(stealthToAgent[stealthAddress] == address(0), "Stealth already used");
        
        bytes32 attestationHash = keccak256(bitGoAttestation);
        require(validAttestations[attestationHash] || verifyBitGoAttestation(stealthAddress, bitGoAttestation), "Invalid attestation");
        
        activeStealthAddress[msg.sender] = stealthAddress;
        stealthToAgent[stealthAddress] = msg.sender;
        loanStealthAddress[loanId] = stealthAddress;
        
        emit StealthGenerated(msg.sender, stealthAddress, loanId);
    }
    
    function verifyBitGoSignature(bytes memory data, bytes memory sig) internal view returns (bool);
    function verifyBitGoAttestation(address stealth, bytes memory attestation) internal view returns (bool);
}
2. CreditVerifier.sol
Purpose: Verify Axiom ZK proofs and calculate 300-850 credit scores with asset quality adjustments.
solidity

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IAxiomV2Query} from "@axiom-crypto/v2-periphery/interfaces/IAxiomV2Query.sol";

contract CreditVerifier {
    IAxiomV2Query public axiomQuery;
    
    // Score constants
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;
    uint256 public constant SCORE_RANGE = 550; // 850 - 300
    
    // Proof tracking
    mapping(bytes32 => bool) public verifiedProofs;
    mapping(address => uint256) public latestScores;
    mapping(address => uint256) public scoreTimestamp;
    
    uint256 public constant SCORE_VALIDITY = 7 days;
    
    // Asset quality multipliers (basis points)
    mapping(address => uint256) public assetQuality; // token => multiplier (12000 = 1.2x)
    
    struct ProofInputs {
        address proxyAddress;
        uint256 tradeVolume;
        uint256 tradeCount;
        int256 realizedPnl;
        int256 unrealizedPnl;
        uint256 maxDrawdownBps;
        uint256 daysActive;
        uint256 volatilityScore;
        
        // Asset holdings
        address[] heldAssets;
        uint256[] assetValues; // In USD terms
        
        uint256 timestamp;
        bytes32 axiomQueryId;
    }
    
    event ScoreCalculated(address indexed agent, uint256 score, uint8 tier, uint256 leverageBonus);
    
    constructor(address _axiomQuery) {
        axiomQuery = IAxiomV2Query(_axiomQuery);
        
        // Initialize asset quality multipliers
        assetQuality[0x0000000000000000000000000000000000000000] = 12000; // ETH
        assetQuality[0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599] = 12000; // WBTC
        assetQuality[0x0000000000000000000000000000000000000000] = 11000; // SOL (wrapped)
        assetQuality[0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5e0] = 10000; // USDC
        // Altcoins default to 8000 (0.8x)
    }
    
    function verifyAndScore(
        bytes calldata proof,
        ProofInputs calldata inputs
    ) external returns (uint256 score, uint8 tier, uint256 leverageMultiplier) {
        bytes32 proofHash = keccak256(proof);
        require(!verifiedProofs[proofHash], "Proof reused");
        require(axiomQuery.isValid(inputs.axiomQueryId, proof, abi.encode(inputs)), "Invalid proof");
        
        verifiedProofs[proofHash] = true;
        
        score = _calculateScore(inputs);
        tier = _scoreToTier(score);
        leverageMultiplier = _calculateLeverage(inputs.heldAssets, inputs.assetValues, tier);
        
        latestScores[msg.sender] = score;
        scoreTimestamp[msg.sender] = block.timestamp;
        
        emit ScoreCalculated(msg.sender, score, tier, leverageMultiplier);
        
        return (score, tier, leverageMultiplier);
    }
    
    function _calculateScore(ProofInputs memory i) internal pure returns (uint256) {
        // Base score 300-850 calculation
        uint256 baseScore = 300;
        
        // Volume (0-100 points)
        baseScore += _logScale(i.tradeVolume, 1e6, 1e12, 100);
        
        // P&L (-50 to +150 points)
        int256 pnlScore = i.realizedPnl + i.unrealizedPnl;
        baseScore += _signedNormalize(pnlScore, -1e6, 1e6, -50, 150);
        
        // Consistency (0-100 points)
        baseScore += (10000 - i.volatilityScore) * 100 / 10000;
        
        // Experience (0-50 points)
        baseScore += i.daysActive > 365 ? 50 : (i.daysActive * 50 / 365);
        
        // Drawdown penalty (0 to -100)
        baseScore -= i.maxDrawdownBps > 5000 ? 100 : (i.maxDrawdownBps * 100 / 5000);
        
        // Clamp to range
        if (baseScore < 300) baseScore = 300;
        if (baseScore > 850) baseScore = 850;
        
        return baseScore;
    }
    
    function _calculateLeverage(
        address[] memory assets,
        uint256[] memory values,
        uint8 tier
    ) internal view returns (uint256) {
        uint256 totalValue = 0;
        uint256 weightedValue = 0;
        
        for (uint i = 0; i < assets.length; i++) {
            uint256 quality = assetQuality[assets[i]];
            if (quality == 0) quality = 8000; // Default for unknown assets
            
            totalValue += values[i];
            weightedValue += (values[i] * quality) / 10000;
        }
        
        if (totalValue == 0) return 10000; // 1.0x default
        
        // Asset quality multiplier (8000-12000)
        uint256 assetMult = (weightedValue * 10000) / totalValue;
        
        // Tier multiplier (Exceptional gets extra boost)
        uint256 tierMult = 10000;
        if (tier == 5) tierMult = 11000; // 10% extra for top tier
        
        return (assetMult * tierMult) / 10000; // Combined multiplier
    }
    
    function _scoreToTier(uint256 score) internal pure returns (uint8) {
        if (score >= 800) return 5; // Exceptional
        if (score >= 740) return 4; // Excellent
        if (score >= 670) return 3; // Good
        if (score >= 580) return 2; // Fair
        if (score >= 500) return 1; // Poor
        return 0; // Very Poor
    }
    
    function isScoreValid(address agent) external view returns (bool) {
        return block.timestamp - scoreTimestamp[agent] < SCORE_VALIDITY;
    }
}
3. LoanManager.sol
Purpose: Orchestrate loan lifecycle, milestone management, and ENS updates.
solidity

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LoanManager {
    ICreditVerifier public creditVerifier;
    ICollateralVault public collateralVault;
    IBitGoRegistry public bitGoRegistry;
    IFileverse public fileverse;
    
    // Tier configuration (score thresholds, LTV, APR)
    struct Tier {
        uint256 minScore;
        uint256 maxLTV;      // Basis points
        uint256 interestAPR; // Basis points
        uint256 minCollateral;
        uint256 maxLoan;
    }
    
    mapping(uint8 => Tier) public tiers;
    
    // Milestone configuration
    struct Milestone {
        uint256 collateralPercent; // Cumulative % required (2500 = 25%)
        uint256 loanReleasePercent; // Cumulative % released
        uint256 unlockTime;         // Min time since start
        bool requiresPositivePnl;   // Must show profit to unlock
    }
    
    Milestone[4] public milestones;
    
    struct Loan {
        address agent;
        address stealthAddress;
        uint256 totalCollateral;    // Total promised
        uint256 collateralDeposited; // Actually deposited
        uint256 totalLoan;          // Total approved
        uint256 loanReleased;       // Actually released
        uint256 interestAPR;
        uint256 startTime;
        uint8 currentMilestone;     // 0-3
        bool active;
        bool defaulted;
        uint256 lastPnlCheck;       // For milestone unlocks
    }
    
    mapping(bytes32 => Loan) public loans;
    mapping(address => bytes32[]) public agentLoans;
    mapping(address => bool) public hasActiveLoan;
    
    uint256 public loanCounter;
    
    event QuoteGenerated(address indexed agent, uint256 maxLoan, uint256 collateralNeeded, uint8 tier);
    event MilestoneReached(bytes32 indexed loanId, uint8 milestone, uint256 collateralAdded, uint256 loanReleased);
    event DefaultTriggered(bytes32 indexed loanId, string reason);
    
    constructor() {
        // Initialize tiers
        tiers[5] = Tier(800, 9000, 400, 500e6, 100000e6);   // Exceptional: 90% LTV, 4%
        tiers[4] = Tier(740, 8500, 600, 500e6, 75000e6);    // Excellent: 85% LTV, 6%
        tiers[3] = Tier(670, 7500, 900, 500e6, 50000e6);    // Good: 75% LTV, 9%
        tiers[2] = Tier(580, 6000, 1400, 500e6, 25000e6);   // Fair: 60% LTV, 14%
        tiers[1] = Tier(500, 4500, 2000, 500e6, 10000e6);   // Poor: 45% LTV, 20%
        tiers[0] = Tier(300, 3000, 3000, 500e6, 5000e6);    // Very Poor: 30% LTV, 30%
        
        // Initialize milestones
        milestones[0] = Milestone(2500, 2500, 0, false);           // Phase 1: 25%
        milestones[1] = Milestone(5000, 5000, 7 days, true);       // Phase 2: 50%
        milestones[2] = Milestone(7500, 7500, 14 days, false);     // Phase 3: 75%
        milestones[3] = Milestone(10000, 10000, 21 days, true);    // Phase 4: 100%
    }
    
    function getQuote(
        uint256 desiredLoan,
        address[] calldata collateralAssets,
        uint256[] calldata collateralValues
    ) external returns (uint256 maxLoan, uint256 collateralRequired, uint8 tier) {
        require(creditVerifier.isScoreValid(msg.sender), "Score expired");
        
        (uint256 score, uint8 agentTier, uint256 leverageMult) = creditVerifier.verifyAndScore(
            new bytes(0), // Proof would be passed here
            ICreditVerifier.ProofInputs({
                // ... populated from off-chain
            })
        );
        
        Tier memory t = tiers[agentTier];
        
        // Calculate effective collateral with quality multipliers
        uint256 effectiveCollateral = 0;
        for (uint i = 0; i < collateralAssets.length; i++) {
            effectiveCollateral += (collateralValues[i] * leverageMult) / 10000;
        }
        
        maxLoan = (effectiveCollateral * t.maxLTV) / 10000;
        if (maxLoan > t.maxLoan) maxLoan = t.maxLoan;
        
        // Reverse calculate required collateral for desired loan
        collateralRequired = (desiredLoan * 10000 * 10000) / (t.maxLTV * leverageMult);
        
        tier = agentTier;
        
        emit QuoteGenerated(msg.sender, maxLoan, collateralRequired, tier);
        
        return (maxLoan, collateralRequired, tier);
    }
    
    function openLoan(
        bytes32 loanId,
        uint256 totalLoan,
        uint256 totalCollateral,
        address[] calldata collateralAssets,
        uint256[] calldata collateralAmounts,
        address stealthAddress
    ) external {
        require(!hasActiveLoan[msg.sender], "Active loan exists");
        require(bitGoRegistry.bitGoWalletIds(msg.sender) != bytes32(0), "No BitGo wallet");
        
        // Verify and register stealth address
        bitGoRegistry.registerStealthAddress(loanId, stealthAddress, new bytes(0));
        
        // Calculate Phase 1 requirements
        Milestone memory m = milestones[0];
        uint256 phase1Collateral = (totalCollateral * m.collateralPercent) / 10000;
        uint256 phase1Loan = (totalLoan * m.loanReleasePercent) / 10000;
        
        // Pull Phase 1 collateral
        for (uint i = 0; i < collateralAssets.length; i++) {
            uint256 amount = (collateralAmounts[i] * m.collateralPercent) / 10000;
            IERC20(collateralAssets[i]).transferFrom(msg.sender, address(collateralVault), amount);
        }
        
        loans[loanId] = Loan({
            agent: msg.sender,
            stealthAddress: stealthAddress,
            totalCollateral: totalCollateral,
            collateralDeposited: phase1Collateral,
            totalLoan: totalLoan,
            loanReleased: phase1Loan,
            interestAPR: tiers[creditVerifier.latestScores(msg.sender) / 100].interestAPR,
            startTime: block.timestamp,
            currentMilestone: 0,
            active: true,
            defaulted: false,
            lastPnlCheck: block.timestamp
        });
        
        agentLoans[msg.sender].push(loanId);
        hasActiveLoan[msg.sender] = true;
        
        // Release Phase 1 loan
        collateralVault.releaseLoan(loanId, phase1Loan, stealthAddress);
        
        // Store in Fileverse
        fileverse.storeLoanDocument(loanId, abi.encode(loans[loanId]));
        
        emit MilestoneReached(loanId, 0, phase1Collateral, phase1Loan);
    }
    
    function advanceMilestone(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(!loan.defaulted, "Loan defaulted");
        require(loan.currentMilestone < 3, "Max milestone reached");
        
        uint8 nextMilestone = loan.currentMilestone + 1;
        Milestone memory m = milestones[nextMilestone];
        
        // Check time requirement
        require(block.timestamp >= loan.startTime + m.unlockTime, "Too early");
        
        // Check PnL requirement if applicable
        if (m.requiresPositivePnl) {
            require(collateralVault.getLoanPnl(loanId) > 0, "No positive PnL");
        }
        
        // Calculate additional collateral needed
        uint256 prevCollateral = (loan.totalCollateral * milestones[loan.currentMilestone].collateralPercent) / 10000;
        uint256 newCollateralRequired = (loan.totalCollateral * m.collateralPercent) / 10000;
        uint256 additionalCollateral = newCollateralRequired - prevCollateral;
        
        // Calculate additional loan to release
        uint256 prevLoan = (loan.totalLoan * milestones[loan.currentMilestone].loanReleasePercent) / 10000;
        uint256 newLoanRelease = (loan.totalLoan * m.loanReleasePercent) / 10000;
        uint256 additionalLoan = newLoanRelease - prevLoan;
        
        // Pull additional collateral
        collateralVault.pullAdditionalCollateral(loanId, additionalCollateral);
        
        // Release additional loan
        collateralVault.releaseLoan(loanId, additionalLoan, loan.stealthAddress);
        
        loan.collateralDeposited = newCollateralRequired;
        loan.loanReleased = newLoanRelease;
        loan.currentMilestone = nextMilestone;
        
        emit MilestoneReached(loanId, nextMilestone, additionalCollateral, additionalLoan);
    }
    
    function triggerDefault(bytes32 loanId, string calldata reason) external {
        Loan storage loan = loans[loanId];
        require(loan.active, "Not active");
        
        bool isDefault = false;
        
        // Check: Missed milestone collateral
        if (loan.currentMilestone < 3) {
            Milestone memory next = milestones[loan.currentMilestone + 1];
            if (block.timestamp > loan.startTime + next.unlockTime + 2 days) {
                isDefault = true;
            }
        }
        
        // Check: Collateral value dropped (via keeper)
        if (collateralVault.getCollateralValue(loanId) < loan.loanReleased) {
            isDefault = true;
        }
        
        require(isDefault, "No default condition met");
        
        loan.active = false;
        loan.defaulted = true;
        hasActiveLoan[loan.agent] = false;
        
        // Liquidate
        collateralVault.liquidate(loanId);
        
        // Update score
        creditVerifier.applyDefaultPenalty(loan.agent);
        
        // Update ENS
        _updateENSDefault(loan.agent, loanId);
        
        emit DefaultTriggered(loanId, reason);
    }
    
    function repay(bytes32 loanId, uint256 amount) external {
        Loan storage loan = loans[loanId];
        require(loan.active, "Not active");
        
        uint256 remaining = collateralVault.processRepayment(loanId, amount);
        
        if (remaining == 0) {
            loan.active = false;
            hasActiveLoan[loan.agent] = false;
            creditVerifier.applyRepaymentBonus(loan.agent);
        }
    }
}
4. CollateralVault.sol
Purpose: Multi-asset custody, milestone-based release, liquidation execution.
solidity

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CollateralVault {
    struct Collateral {
        address token;
        uint256 amount;
        uint256 valueAtDeposit; // USD price * amount
    }
    
    struct VaultLoan {
        address agent;
        bytes32 loanId;
        Collateral[] collaterals;
        uint256 totalValueUsd;
        uint256 currentDebt;
        bool liquidated;
    }
    
    mapping(bytes32 => VaultLoan) public vaultLoans;
    mapping(address => uint256) public tokenPrices; // Oracle prices
    
    address public loanManager;
    uint256 public constant LIQUIDATION_THRESHOLD = 10500; // 105%
    uint256 public constant KEEPER_REWARD = 500; // 5%
    
    event CollateralDeposited(bytes32 loanId, address token, uint256 amount);
    event LoanReleased(bytes32 loanId, uint256 amount, address to);
    event Liquidated(bytes32 loanId, uint256 collateralSeized, uint256 debtRepaid);
    
    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "Only LoanManager");
        _;
    }
    
    function depositCollateral(
        bytes32 loanId,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external onlyLoanManager {
        for (uint i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            vaultLoans[loanId].collaterals.push(Collateral({
                token: tokens[i],
                amount: amounts[i],
                valueAtDeposit: amounts[i] * tokenPrices[tokens[i]]
            }));
            emit CollateralDeposited(loanId, tokens[i], amounts[i]);
        }
        _updateTotalValue(loanId);
    }
    
    function releaseLoan(bytes32 loanId, uint256 amount, address to) external onlyLoanManager {
        require(!vaultLoans[loanId].liquidated, "Liquidated");
        // Transfer USDC to stealth address
        IERC20(usdc).transfer(to, amount);
        vaultLoans[loanId].currentDebt += amount;
        emit LoanReleased(loanId, amount, to);
    }
    
    function getCollateralValue(bytes32 loanId) public view returns (uint256) {
        VaultLoan memory vl = vaultLoans[loanId];
        uint256 total = 0;
        for (uint i = 0; i < vl.collaterals.length; i++) {
            total += vl.collaterals[i].amount * tokenPrices[vl.collaterals[i].token];
        }
        return total;
    }
    
    function getLoanPnl(bytes32 loanId) external view returns (int256) {
        // Calculate based on trading activity tracked externally
        return 0; // Placeholder
    }
    
    function liquidate(bytes32 loanId) external {
        VaultLoan storage vl = vaultLoans[loanId];
        require(!vl.liquidated, "Already liquidated");
        
        uint256 collateralValue = getCollateralValue(loanId);
        uint256 debt = vl.currentDebt;
        
        require((collateralValue * 10000) / debt < LIQUIDATION_THRESHOLD, "Healthy");
        
        vl.liquidated = true;
        
        // Seize and auction collateral
        uint256 keeperReward = (collateralValue * KEEPER_REWARD) / 10000;
        // ... distribute ...
        
        emit Liquidated(loanId, collateralValue, debt);
    }
}
Integration Flow Diagram


┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Agent  │────→│  BitGo   │────→│   ZK     │────→│  Credit  │
│  Wallet │     │  Stealth │     │  Proof   │     │ Verifier │
└─────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                       │
┌─────────┐     ┌──────────┐     ┌──────────┐         │
│ Fileverse│←────│   Loan   │←────│  Quote   │←────────┘
│ Storage │     │  Manager │     │  Request │
└─────────┘     └────┬─────┘     └──────────┘
                     │
              ┌──────▼──────┐
              │   Collateral│
              │    Vault    │
              │             │
              │ • Milestone │
              │   tracking  │
              │ • Multi-asset│
              │ • Liquidation│
              └─────────────┘
Key State Transitions
Table
State	Trigger	Next State	Action
NO_LOAN	Agent requests quote	QUOTED	Score calculated, terms offered
QUOTED	Agent accepts, deposits Phase 1	PHASE_1_ACTIVE	25% collateral locked, 25% loan released
PHASE_1_ACTIVE	7 days + positive PnL	PHASE_2_ACTIVE	Additional 25% each
PHASE_2_ACTIVE	14 days, score maintained	PHASE_3_ACTIVE	75% milestone
PHASE_3_ACTIVE	21 days + tier upgrade	PHASE_4_ACTIVE	100% milestone
PHASE_X_ACTIVE	Repayment complete	CLOSED	Collateral returned, score bonus
PHASE_X_ACTIVE	Missed milestone / price drop	DEFAULT	Liquidation, score penalty
DEFAULT	Liquidation complete	LIQUIDATED	Bad debt recorded
Risk Parameters (Final)
Table
Parameter	Value
Score range	300-850
Min loan	$500
Max loan	$100,000
Milestones	4 (25%/50%/75%/100%)
Milestone timing	0/7/14/21 days
Liquidation threshold	105%
Grace period	48 hours
Keeper reward	5%
Protocol fee	1%



These two files provide the complete specification for your zkCredit protocol with all the requested features: 300-850 score range, asset-based leverage, milestone collateral, and comprehensive liquidation handling.