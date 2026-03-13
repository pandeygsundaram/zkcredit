// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CreditVerifier} from "./CreditVerifier.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {StealthRegistry} from "./StealthRegistry.sol";
import {BitGoRegistry} from "./BitGoRegistry.sol";
import {ZKCreditResolver} from "./ZKCreditResolver.sol";

contract LoanManager {
    CreditVerifier public immutable creditVerifier;
    CollateralVault public immutable collateralVault;
    StealthRegistry public immutable stealthRegistry;
    BitGoRegistry public immutable bitGoRegistry;
    ZKCreditResolver public immutable resolver;
    address public owner;

    uint256 public constant PHASE_COUNT = 4;
    uint256 public constant PHASE_INTERVAL = 7 days;
    uint256 public constant GRACE_PERIOD = 48 hours;

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

    uint256 public loanCounter;
    mapping(bytes32 => Loan) public loans;
    mapping(bytes32 => LoanCollateralPlan[]) public loanCollateralPlans;
    mapping(address => bytes32[]) public agentLoans;
    mapping(address => bool) public hasActiveLoan;
    mapping(address => uint256) public assetQualityBps;

    event LoanOpened(bytes32 indexed loanId, address indexed agent, address indexed stealthAddress);
    event MilestoneProgressed(bytes32 indexed loanId, uint8 phase, uint256 collateralAdded, uint256 principalReleased);
    event MilestoneExtended(bytes32 indexed loanId, uint256 extensionSeconds, uint256 newCheckpoint);
    event LoanRepaid(bytes32 indexed loanId);
    event DefaultTriggered(bytes32 indexed loanId, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address verifier_, address vault_, address stealth_, address bitgo_, address resolver_) {
        creditVerifier = CreditVerifier(verifier_);
        collateralVault = CollateralVault(vault_);
        stealthRegistry = StealthRegistry(stealth_);
        bitGoRegistry = BitGoRegistry(bitgo_);
        resolver = ZKCreditResolver(resolver_);
        owner = msg.sender;
    }

    /// @notice Sets collateral quality multiplier for quote calculation.
    /// @param token Collateral token address.
    /// @param qualityBps Quality multiplier in bps (8000-12000).
    function setAssetQuality(address token, uint256 qualityBps) external onlyOwner {
        require(qualityBps >= 8000 && qualityBps <= 12000, "invalid quality");
        assetQualityBps[token] = qualityBps;
    }

    /// @notice Returns quote based on valid score and provided collateral basket.
    /// @param collateralTokens Token list.
    /// @param collateralAmounts Amount list.
    function getQuote(address[] calldata collateralTokens, uint256[] calldata collateralAmounts)
        public
        view
        returns (uint256 score, uint8 tier, uint256 aprBps, uint256 maxPrincipal)
    {
        require(collateralTokens.length == collateralAmounts.length, "length mismatch");
        require(creditVerifier.isScoreValid(msg.sender), "score expired");

        uint256 effectiveCollateral = _effectiveCollateral(collateralTokens, collateralAmounts);
        (uint256 s, uint256 levRaw, ) = creditVerifier.latestRecords(msg.sender);

        uint8 t = creditVerifier.scoreToTier(s);
        uint256 lev = levRaw == 0 ? 10000 : levRaw;
        uint256 ltv = creditVerifier.tierToLtvBps(t);
        uint256 apr = creditVerifier.tierToAprBps(t);
        uint256 maxP = (effectiveCollateral * ltv * lev) / (10000 * 10000);

        return (s, t, apr, maxP);
    }

    /// @notice Opens a new loan and links stealth address (self-custody or BitGo path).
    /// @param collateralTokens Collateral token list.
    /// @param collateralAmounts Collateral amount list.
    /// @param totalPrincipal Desired total principal.
    /// @param stealthAddress Loan-specific stealth address.
    /// @param attestOrSignature Self signature or BitGo attestation.
    function openLoan(
        address[] calldata collateralTokens,
        uint256[] calldata collateralAmounts,
        uint256 totalPrincipal,
        address stealthAddress,
        bytes calldata attestOrSignature
    ) external returns (bytes32 loanId) {
        require(!hasActiveLoan[msg.sender], "active loan");
        require(totalPrincipal >= 500e6, "below min loan");
        require(collateralTokens.length == collateralAmounts.length && collateralTokens.length > 0, "invalid collateral");

        (uint256 score, uint8 tier, uint256 aprBps, uint256 maxPrincipal) = getQuote(collateralTokens, collateralAmounts);
        require(totalPrincipal <= maxPrincipal && totalPrincipal <= 100000e6, "principal too high");

        // Tier 4+ hardening: if not BitGo verified, require stronger collateral equivalent to tier-3 minimum.
        if (tier >= 4 && !bitGoRegistry.isBitGoVerified(msg.sender)) {
            uint256 effectiveCollateral = _effectiveCollateral(collateralTokens, collateralAmounts);
            ( , uint256 levRaw, ) = creditVerifier.latestRecords(msg.sender);
            uint256 lev = levRaw == 0 ? 10000 : levRaw;
            uint256 tier3MinCollateral = (totalPrincipal * 10000 * 10000) / (creditVerifier.tierToLtvBps(3) * lev);
            require(effectiveCollateral >= tier3MinCollateral, "Tier 4+ requires BitGo verification or extra collateral");
        }

        loanId = keccak256(abi.encodePacked(msg.sender, block.chainid, ++loanCounter));

        if (bitGoRegistry.isBitGoVerified(msg.sender)) {
            stealthRegistry.linkStealthAddressBitGoFor(msg.sender, loanId, stealthAddress, attestOrSignature);
        } else {
            require(stealthRegistry.metaAddresses(msg.sender) != bytes32(0), "missing meta-address");
            stealthRegistry.linkStealthAddressFor(msg.sender, stealthAddress, loanId, attestOrSignature);
        }

        (address[] memory phaseTokens, uint256[] memory phaseAmounts) = _phaseOneCollateral(collateralTokens, collateralAmounts);
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
            uint256 p = collateralAmounts[i] / PHASE_COUNT;
            p += collateralAmounts[i] - (p * PHASE_COUNT);
            loanCollateralPlans[loanId].push(LoanCollateralPlan({token: collateralTokens[i], totalAmount: collateralAmounts[i], postedAmount: p}));
        }

        hasActiveLoan[msg.sender] = true;
        agentLoans[msg.sender].push(loanId);
        _updateResolver(loanId, true);

        emit LoanOpened(loanId, msg.sender, stealthAddress);
    }

    /// @notice Progresses loan to next milestone (deposit next collateral tranche and release principal tranche).
    /// @param loanId Loan identifier.
    function progressMilestone(bytes32 loanId) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid && !l.liquidated, "inactive");
        require(msg.sender == l.agent, "only agent");
        require(l.phase < PHASE_COUNT, "all phases done");
        require(block.timestamp >= l.lastPhaseAt + PHASE_INTERVAL, "too early");
        require(block.timestamp <= l.lastPhaseAt + PHASE_INTERVAL + GRACE_PERIOD, "grace expired");

        uint256 principalToRelease = l.targetPrincipal / PHASE_COUNT;
        if (l.phase == PHASE_COUNT - 1) principalToRelease = l.targetPrincipal - l.releasedPrincipal;

        uint256 collateralAddedValue;
        LoanCollateralPlan[] storage plans = loanCollateralPlans[loanId];
        for (uint256 i = 0; i < plans.length; i++) {
            uint256 amountToAdd = plans[i].totalAmount / PHASE_COUNT;
            if (l.phase == PHASE_COUNT - 1) amountToAdd = plans[i].totalAmount - plans[i].postedAmount;
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

    /// @notice Extends current milestone checkpoint to avoid immediate default.
    /// @param loanId Loan identifier.
    /// @param extensionSeconds Extension duration (max 7 days).
    function extendMilestone(bytes32 loanId, uint256 extensionSeconds) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid && !l.liquidated, "inactive");
        require(msg.sender == l.agent, "only agent");
        require(extensionSeconds > 0 && extensionSeconds <= 7 days, "invalid extension");

        l.lastPhaseAt += extensionSeconds;
        emit MilestoneExtended(loanId, extensionSeconds, l.lastPhaseAt);
    }

    /// @notice Repays debt from caller and closes loan when fully repaid.
    /// @param loanId Loan identifier.
    /// @param amount Repayment amount in USDC terms.
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

    /// @notice Triggers default and liquidation when conditions are met.
    /// @param loanId Loan identifier.
    /// @param reason Human-readable reason emitted for off-chain monitoring.
    function triggerDefault(bytes32 loanId, string calldata reason) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid && !l.liquidated, "inactive");

        bool missedMilestone = block.timestamp > l.lastPhaseAt + PHASE_INTERVAL + GRACE_PERIOD;
        bool underwater = collateralVault.getCollateralValue(loanId) < l.releasedPrincipal;
        require(missedMilestone || underwater, "no default condition");

        collateralVault.liquidate(loanId);
        creditVerifier.applyDefaultPenalty(l.agent);
        emit DefaultTriggered(loanId, reason);
    }

    /// @notice Callback used by vault to mark loan as defaulted.
    /// @param loanId Loan identifier.
    function recordDefault(bytes32 loanId) external {
        require(msg.sender == address(collateralVault), "only vault");
        Loan storage l = loans[loanId];
        if (!l.active) return;

        l.active = false;
        l.liquidated = true;
        hasActiveLoan[l.agent] = false;
        _updateResolver(loanId, false);
    }

    function _phaseOnePrincipal(uint256 totalPrincipal) internal pure returns (uint256 out) {
        out = totalPrincipal / PHASE_COUNT;
        out += totalPrincipal - (out * PHASE_COUNT);
    }

    function _phaseOneCollateral(address[] calldata tokens, uint256[] calldata amounts)
        internal
        pure
        returns (address[] memory phaseTokens, uint256[] memory phaseAmounts)
    {
        phaseTokens = new address[](tokens.length);
        phaseAmounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 p = amounts[i] / PHASE_COUNT;
            p += amounts[i] - (p * PHASE_COUNT);
            phaseTokens[i] = tokens[i];
            phaseAmounts[i] = p;
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
        resolver.registerENS(node, l.agent);
        resolver.setText(node, "zkcredit.score", _toString(l.scoreAtOpen));
        resolver.setText(node, "zkcredit.tier", _toString(l.tierAtOpen));
        resolver.setText(node, "zkcredit.activeLoan", activeLoan ? "true" : "false");
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 len;
        while (tmp != 0) {
            len++;
            tmp /= 10;
        }
        bytes memory out = new bytes(len);
        while (v != 0) {
            len -= 1;
            out[len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(out);
    }
}
