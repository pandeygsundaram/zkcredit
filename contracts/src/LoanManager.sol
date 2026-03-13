// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CreditVerifier} from "./CreditVerifier.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {BitGoRegistry} from "./BitGoRegistry.sol";
import {ZKCreditResolver} from "./ZKCreditResolver.sol";

contract LoanManager {
    CreditVerifier public immutable creditVerifier;
    CollateralVault public immutable collateralVault;
    BitGoRegistry public immutable bitGoRegistry;
    ZKCreditResolver public immutable resolver;
    address public owner;

    uint256 public constant PHASE_COUNT = 4;
    uint256 public constant PHASE_INTERVAL = 7 days;
    uint256 public constant GRACE_PERIOD = 48 hours;

    uint256 public loanCounter;

    struct Tier {
        uint256 minScore;
        uint256 maxLTV;
        uint256 interestAPR;
        uint256 minCollateral;
        uint256 maxLoan;
    }

    struct Milestone {
        uint256 collateralPercent;
        uint256 loanReleasePercent;
        uint256 unlockTime;
        bool requiresPositivePnl;
    }

    struct LoanCollateralPlan {
        address token;
        uint256 totalAmount;
        uint256 postedAmount;
    }

    struct Loan {
        address agent;
        address stealthAddress;
        uint256 scoreAtOpen;
        uint8 tierAtOpen;
        uint256 aprBps;
        uint256 targetPrincipal;
        uint256 targetCollateral;
        uint256 releasedPrincipal;
        uint256 postedCollateral;
        uint8 phase;
        uint256 lastPhaseAt;
        bool active;
        bool repaid;
        bool liquidated;
    }

    mapping(bytes32 => Loan) public loans;
    mapping(bytes32 => LoanCollateralPlan[]) public loanCollateralPlans;
    mapping(address => bytes32[]) public agentLoans;
    mapping(address => bool) public hasActiveLoan;

    mapping(address => uint256) public assetQualityBps;
    mapping(uint8 => Tier) public tiers;
    Milestone[4] public milestones;

    event AssetQualitySet(address indexed token, uint256 qualityBps);
    event QuoteGenerated(address indexed agent, uint256 maxLoan, uint256 collateralNeeded, uint8 tier);
    event LoanOpened(bytes32 indexed loanId, address indexed agent, address indexed stealthAddress);
    event MilestoneProgressed(bytes32 indexed loanId, uint8 phase, uint256 collateralAdded, uint256 principalReleased);
    event LoanRepaid(bytes32 indexed loanId);
    event DefaultRecorded(address indexed agent, bytes32 indexed loanId);
    event DefaultTriggered(bytes32 indexed loanId, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address verifier_, address vault_, address bitgo_, address resolver_) {
        creditVerifier = CreditVerifier(verifier_);
        collateralVault = CollateralVault(vault_);
        bitGoRegistry = BitGoRegistry(bitgo_);
        resolver = ZKCreditResolver(resolver_);
        owner = msg.sender;

        tiers[5] = Tier(800, 9000, 400, 500e6, 100000e6);
        tiers[4] = Tier(740, 8500, 600, 500e6, 75000e6);
        tiers[3] = Tier(670, 7500, 900, 500e6, 50000e6);
        tiers[2] = Tier(580, 6000, 1400, 500e6, 25000e6);
        tiers[1] = Tier(500, 4500, 2000, 500e6, 10000e6);
        tiers[0] = Tier(300, 3000, 3000, 500e6, 5000e6);

        milestones[0] = Milestone(2500, 2500, 0, false);
        milestones[1] = Milestone(5000, 5000, 7 days, true);
        milestones[2] = Milestone(7500, 7500, 14 days, false);
        milestones[3] = Milestone(10000, 10000, 21 days, true);
    }

    function setAssetQuality(address token, uint256 qualityBps) external onlyOwner {
        require(qualityBps >= 8000 && qualityBps <= 12000, "invalid quality");
        assetQualityBps[token] = qualityBps;
        emit AssetQualitySet(token, qualityBps);
    }

    function getQuote(address[] calldata collateralTokens, uint256[] calldata collateralAmounts)
        public
        view
        returns (uint256 score, uint8 tier, uint256 aprBps, uint256 maxPrincipal)
    {
        require(collateralTokens.length == collateralAmounts.length, "length mismatch");

        uint256 effectiveCollateral = _effectiveCollateral(collateralTokens, collateralAmounts);

        (uint256 s, uint256 levRaw, uint256 updatedAt) = creditVerifier.latestRecords(msg.sender);
        require(s >= creditVerifier.MIN_SCORE(), "missing score");
        require(block.timestamp <= updatedAt + creditVerifier.SCORE_VALIDITY(), "expired score");

        uint8 t = creditVerifier.scoreToTier(s);
        uint256 lev = levRaw == 0 ? 10000 : levRaw;
        uint256 ltv = creditVerifier.tierToLtvBps(t);
        uint256 apr = creditVerifier.tierToAprBps(t);
        uint256 maxP = (effectiveCollateral * ltv * lev) / (10000 * 10000);

        return (s, t, apr, maxP);
    }

    function getQuote(uint256 desiredLoan, address[] calldata collateralAssets, uint256[] calldata collateralValues)
        external
        returns (uint256 maxLoan, uint256 collateralRequired, uint8 tier)
    {
        require(creditVerifier.isScoreValid(msg.sender), "Score expired");
        (uint256 s, uint256 levRaw, ) = creditVerifier.latestRecords(msg.sender);
        uint8 t = creditVerifier.scoreToTier(s);
        uint256 leverageMult = levRaw == 0 ? 10000 : levRaw;

        uint256 effectiveCollateral = _effectiveCollateral(collateralAssets, collateralValues);
        Tier memory cfg = tiers[t];

        maxLoan = (effectiveCollateral * cfg.maxLTV * leverageMult) / (10000 * 10000);
        if (maxLoan > cfg.maxLoan) maxLoan = cfg.maxLoan;
        collateralRequired = (desiredLoan * 10000 * 10000) / (cfg.maxLTV * leverageMult);
        tier = t;

        emit QuoteGenerated(msg.sender, maxLoan, collateralRequired, tier);
    }

    function openLoan(
        address[] calldata collateralTokens,
        uint256[] calldata collateralAmounts,
        uint256 totalPrincipal,
        address stealthAddress,
        bytes calldata bitGoAttestation
    ) external returns (bytes32 loanId) {
        require(!hasActiveLoan[msg.sender], "active loan");
        require(totalPrincipal > 0, "invalid principal");
        require(collateralTokens.length == collateralAmounts.length, "length mismatch");
        require(collateralTokens.length > 0, "no collateral");
        require(bitGoRegistry.walletIds(msg.sender) != bytes32(0), "no bitgo wallet");

        (uint256 score, uint8 tier, uint256 aprBps, uint256 maxPrincipal) = getQuote(collateralTokens, collateralAmounts);
        require(totalPrincipal <= maxPrincipal, "principal too high");

        loanCounter += 1;
        loanId = keccak256(abi.encodePacked(msg.sender, block.chainid, loanCounter));
        bitGoRegistry.linkStealthAddressFor(msg.sender, loanId, stealthAddress, bitGoAttestation);

        (address[] memory phaseTokens, uint256[] memory phaseAmounts) = _buildPhaseOne(collateralTokens, collateralAmounts);
        uint256 phasePrincipal = _phaseOnePrincipal(totalPrincipal);
        uint256 totalCollateralValue = collateralVault.previewCollateralValue(collateralTokens, collateralAmounts);
        uint256 phaseCollateralValue = collateralVault.previewCollateralValue(phaseTokens, phaseAmounts);

        collateralVault.fundInitialLoan(loanId, msg.sender, stealthAddress, phaseTokens, phaseAmounts, phasePrincipal, aprBps);

        Loan storage l = loans[loanId];
        l.agent = msg.sender;
        l.stealthAddress = stealthAddress;
        l.scoreAtOpen = score;
        l.tierAtOpen = tier;
        l.aprBps = aprBps;
        l.targetPrincipal = totalPrincipal;
        l.targetCollateral = totalCollateralValue;
        l.releasedPrincipal = phasePrincipal;
        l.postedCollateral = phaseCollateralValue;
        l.phase = 1;
        l.lastPhaseAt = block.timestamp;
        l.active = true;

        for (uint256 i = 0; i < collateralTokens.length; i++) {
            uint256 phaseAmount = collateralAmounts[i] / PHASE_COUNT;
            phaseAmount += collateralAmounts[i] - (phaseAmount * PHASE_COUNT);
            loanCollateralPlans[loanId].push(
                LoanCollateralPlan({token: collateralTokens[i], totalAmount: collateralAmounts[i], postedAmount: phaseAmount})
            );
        }

        hasActiveLoan[msg.sender] = true;
        agentLoans[msg.sender].push(loanId);
        _updateResolver(loanId, true);

        emit LoanOpened(loanId, msg.sender, stealthAddress);
    }

    function progressMilestone(bytes32 loanId) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid && !l.liquidated, "inactive");
        require(msg.sender == l.agent, "only agent");
        require(l.phase < PHASE_COUNT, "all phases done");
        uint8 nextMilestone = l.phase;
        Milestone memory m = milestones[nextMilestone];
        require(block.timestamp >= l.lastPhaseAt + m.unlockTime - milestones[nextMilestone - 1].unlockTime, "too early");
        require(block.timestamp <= l.lastPhaseAt + (m.unlockTime - milestones[nextMilestone - 1].unlockTime) + GRACE_PERIOD, "grace exceeded");

        if (m.requiresPositivePnl) {
            require(collateralVault.getLoanPnl(loanId) >= 0, "No positive PnL");
        }

        uint256 principalToRelease = l.targetPrincipal / PHASE_COUNT;
        if (l.phase == PHASE_COUNT - 1) {
            principalToRelease = l.targetPrincipal - l.releasedPrincipal;
        }

        uint256 collateralAddedValue;
        LoanCollateralPlan[] storage plans = loanCollateralPlans[loanId];
        for (uint256 i = 0; i < plans.length; i++) {
            uint256 amountToAdd = plans[i].totalAmount / PHASE_COUNT;
            if (l.phase == PHASE_COUNT - 1) {
                amountToAdd = plans[i].totalAmount - plans[i].postedAmount;
            }
            plans[i].postedAmount += amountToAdd;

            collateralVault.addCollateral(loanId, plans[i].token, amountToAdd);
            collateralAddedValue += collateralVault.previewSingleCollateralValue(plans[i].token, amountToAdd);
        }

        collateralVault.releaseTranche(loanId, principalToRelease);

        l.postedCollateral += collateralAddedValue;
        l.releasedPrincipal += principalToRelease;
        l.phase += 1;
        l.lastPhaseAt = block.timestamp;

        emit MilestoneProgressed(loanId, l.phase, collateralAddedValue, principalToRelease);
    }

    function repay(bytes32 loanId, uint256 amount) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid && !l.liquidated, "inactive");

        if (collateralVault.processRepayment(loanId, amount, msg.sender) == 0) {
            l.active = false;
            l.repaid = true;
            hasActiveLoan[l.agent] = false;
            creditVerifier.applyRepaymentBonus(l.agent);
            _updateResolver(loanId, false);
            emit LoanRepaid(loanId);
        }
    }

    function triggerDefault(bytes32 loanId, string calldata reason) external {
        Loan storage loan = loans[loanId];
        require(loan.active && !loan.repaid && !loan.liquidated, "Not active");

        bool isDefault = false;
        if (loan.phase < 4) {
            Milestone memory next = milestones[loan.phase];
            uint256 sinceLast = next.unlockTime - milestones[loan.phase - 1].unlockTime;
            if (block.timestamp > loan.lastPhaseAt + sinceLast + GRACE_PERIOD) isDefault = true;
        }

        if (collateralVault.getCollateralValue(loanId) < loan.releasedPrincipal) {
            isDefault = true;
        }
        require(isDefault, "No default condition met");

        collateralVault.liquidate(loanId);
        creditVerifier.applyDefaultPenalty(loan.agent);
        emit DefaultTriggered(loanId, reason);
    }

    function recordDefault(bytes32 loanId) external {
        require(msg.sender == address(collateralVault), "only vault");
        Loan storage l = loans[loanId];
        if (!l.active) return;

        l.active = false;
        l.liquidated = true;
        hasActiveLoan[l.agent] = false;
        _updateResolver(loanId, false);

        emit DefaultRecorded(l.agent, loanId);
    }

    function _phaseOnePrincipal(uint256 totalPrincipal) internal pure returns (uint256 phasePrincipal) {
        phasePrincipal = totalPrincipal / PHASE_COUNT;
        phasePrincipal += totalPrincipal - (phasePrincipal * PHASE_COUNT);
    }

    function _buildPhaseOne(address[] calldata tokens, uint256[] calldata amounts)
        internal
        pure
        returns (address[] memory phaseTokens, uint256[] memory phaseAmounts)
    {
        uint256 n = tokens.length;
        phaseTokens = new address[](n);
        phaseAmounts = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            uint256 phaseAmount = amounts[i] / PHASE_COUNT;
            phaseAmount += amounts[i] - (phaseAmount * PHASE_COUNT);
            phaseTokens[i] = tokens[i];
            phaseAmounts[i] = phaseAmount;
        }
    }

    function _effectiveCollateral(address[] calldata tokens, uint256[] calldata amounts) internal view returns (uint256 effective) {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 q = assetQualityBps[tokens[i]];
            if (q == 0) q = 10000;
            effective += (amounts[i] * q) / 10000;
        }
    }

    function _updateResolver(bytes32 loanId, bool activeLoan) internal {
        Loan memory l = loans[loanId];
        bytes32 node = keccak256(abi.encodePacked(l.agent));
        resolver.registerNode(node, l.agent);
        resolver.setText(node, "zkcredit.activeLoan", activeLoan ? "true" : "false");
    }
}
