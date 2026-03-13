// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20Like {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ILoanManagerCallback {
    function recordDefault(bytes32 loanId) external;
}

contract CollateralVault {
    IERC20Like public immutable usdc;
    address public loanManager;

    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 10500;
    uint256 public constant KEEPER_REWARD_BPS = 500;
    uint256 public constant PROTOCOL_FEE_BPS = 100;

    uint256 public protocolReserves;

    struct TokenCollateral {
        address token;
        uint256 amount;
    }

    struct VaultLoan {
        address agent;
        address stealthAddress;
        uint256 collateral; // USD-like value in 1e6 precision
        uint256 principal;
        uint256 aprBps;
        uint256 totalRepaid;
        uint256 startTime;
        uint256 lastAccrual;
        bool active;
        bool liquidated;
    }

    mapping(bytes32 => VaultLoan) public loans;
    mapping(bytes32 => TokenCollateral[]) public loanCollaterals;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenPrice; // 1e18 price scalar

    event SupportedTokenSet(address indexed token, bool supported, uint256 price);
    event LoanFunded(bytes32 indexed loanId, address indexed agent, address indexed stealthAddress, uint256 collateralValue, uint256 principal);
    event CollateralAdded(bytes32 indexed loanId, address indexed token, uint256 amount, uint256 value);
    event TrancheReleased(bytes32 indexed loanId, uint256 amount);
    event RepaymentProcessed(bytes32 indexed loanId, uint256 amount, uint256 debtLeft, bool fullyRepaid);
    event LoanLiquidated(bytes32 indexed loanId, address indexed keeper, uint256 keeperReward, uint256 protocolFee, uint256 repaidDebt);

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "only manager");
        _;
    }

    constructor(address usdc_) {
        require(usdc_ != address(0), "invalid usdc");
        usdc = IERC20Like(usdc_);
        loanManager = msg.sender;
        supportedTokens[usdc_] = true;
        tokenPrice[usdc_] = 1e18;
    }

    /// @notice Sets LoanManager allowed to mutate loan state.
    /// @param next New manager address.
    function setLoanManager(address next) external onlyLoanManager {
        require(next != address(0), "invalid manager");
        loanManager = next;
    }

    /// @notice Adds or updates a supported collateral token and its price scalar.
    /// @param token Token address.
    /// @param supported Whether token is enabled.
    /// @param price Price scalar (1e18 = 1x).
    function setSupportedToken(address token, bool supported, uint256 price) external onlyLoanManager {
        require(token != address(0), "invalid token");
        require(price > 0, "invalid price");
        supportedTokens[token] = supported;
        tokenPrice[token] = price;
        emit SupportedTokenSet(token, supported, price);
    }

    /// @notice Preview total collateral value for a basket.
    function previewCollateralValue(address[] calldata tokens, uint256[] calldata amounts) external view returns (uint256 totalValue) {
        require(tokens.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(supportedTokens[tokens[i]], "unsupported token");
            totalValue += _valueOf(tokens[i], amounts[i]);
        }
    }

    /// @notice Preview collateral value for one token amount.
    function previewSingleCollateralValue(address token, uint256 amount) external view returns (uint256) {
        require(supportedTokens[token], "unsupported token");
        return _valueOf(token, amount);
    }

    /// @notice Deposits phase-1 collateral and releases phase-1 principal.
    function fundInitialLoan(
        bytes32 loanId,
        address agent,
        address stealthAddress,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 principal,
        uint256 aprBps
    ) external onlyLoanManager {
        require(!loans[loanId].active, "exists");
        require(tokens.length == amounts.length, "length mismatch");

        uint256 totalCollateralValue;
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = amounts[i];
            require(supportedTokens[token], "unsupported token");
            require(IERC20Like(token).transferFrom(agent, address(this), amount), "collateral transfer failed");

            loanCollaterals[loanId].push(TokenCollateral({token: token, amount: amount}));
            totalCollateralValue += _valueOf(token, amount);
        }

        require(_push(stealthAddress, principal), "loan transfer failed");

        loans[loanId] = VaultLoan({
            agent: agent,
            stealthAddress: stealthAddress,
            collateral: totalCollateralValue,
            principal: principal,
            aprBps: aprBps,
            totalRepaid: 0,
            startTime: block.timestamp,
            lastAccrual: block.timestamp,
            active: true,
            liquidated: false
        });

        emit LoanFunded(loanId, agent, stealthAddress, totalCollateralValue, principal);
    }

    /// @notice Adds additional collateral for a milestone.
    function addCollateral(bytes32 loanId, address token, uint256 amount) external onlyLoanManager {
        VaultLoan storage l = loans[loanId];
        require(l.active && !l.liquidated, "inactive");
        require(supportedTokens[token], "unsupported token");
        require(IERC20Like(token).transferFrom(l.agent, address(this), amount), "transfer failed");

        loanCollaterals[loanId].push(TokenCollateral({token: token, amount: amount}));
        uint256 valueAdded = _valueOf(token, amount);
        l.collateral += valueAdded;

        emit CollateralAdded(loanId, token, amount, valueAdded);
    }

    /// @notice Releases next principal tranche to stealth address.
    function releaseTranche(bytes32 loanId, uint256 amount) external onlyLoanManager {
        VaultLoan storage l = loans[loanId];
        require(l.active && !l.liquidated, "inactive");
        l.principal += amount;
        require(_push(l.stealthAddress, amount), "transfer failed");
        emit TrancheReleased(loanId, amount);
    }

    /// @notice Processes repayment and returns remaining debt.
    function processRepayment(bytes32 loanId, uint256 amount, address from)
        external
        onlyLoanManager
        returns (uint256 remaining)
    {
        VaultLoan storage l = loans[loanId];
        require(l.active && !l.liquidated, "inactive");
        require(_pull(from, amount), "repay transfer failed");

        uint256 debt = getCurrentDebt(loanId);
        l.totalRepaid += amount;
        l.lastAccrual = block.timestamp;

        bool fullyRepaid;
        if (l.totalRepaid >= debt) {
            fullyRepaid = true;
            l.active = false;
            _returnAllCollateral(loanId, l.agent);
        }

        uint256 debtLeft = fullyRepaid ? 0 : debt - l.totalRepaid;
        remaining = debtLeft;
        emit RepaymentProcessed(loanId, amount, debtLeft, fullyRepaid);
    }

    /// @notice Liquidates unsafe loans and pays keeper reward.
    function liquidate(bytes32 loanId) external {
        VaultLoan storage l = loans[loanId];
        require(l.active && !l.liquidated, "inactive");

        uint256 debt = getCurrentDebt(loanId);
        require(debt > 0, "no debt");
        uint256 ratio = (l.collateral * 10000) / debt;
        require(ratio < LIQUIDATION_THRESHOLD_BPS, "healthy");

        l.active = false;
        l.liquidated = true;

        uint256 keeperReward = (l.collateral * KEEPER_REWARD_BPS) / 10000;
        uint256 protocolFee = (l.collateral * PROTOCOL_FEE_BPS) / 10000;
        uint256 availableToRepay = l.collateral - keeperReward - protocolFee;
        uint256 repaidDebt = availableToRepay > debt ? debt : availableToRepay;

        protocolReserves += protocolFee;
        require(_push(msg.sender, keeperReward), "keeper transfer failed");

        ILoanManagerCallback(loanManager).recordDefault(loanId);
        emit LoanLiquidated(loanId, msg.sender, keeperReward, protocolFee, repaidDebt);
    }

    /// @notice Returns current debt including accrued interest.
    function getCurrentDebt(bytes32 loanId) public view returns (uint256) {
        VaultLoan memory l = loans[loanId];
        if (!l.active || l.liquidated) return 0;
        uint256 elapsed = block.timestamp - l.lastAccrual;
        uint256 interest = (l.principal * l.aprBps * elapsed) / (365 days * 10000);
        uint256 grossDebt = l.principal + interest;
        if (l.totalRepaid >= grossDebt) return 0;
        return grossDebt - l.totalRepaid;
    }

    /// @notice Returns collateral ratio in basis points.
    function getCollateralRatioBps(bytes32 loanId) external view returns (uint256) {
        VaultLoan memory l = loans[loanId];
        if (!l.active || l.liquidated) return type(uint256).max;
        uint256 debt = getCurrentDebt(loanId);
        if (debt == 0) return type(uint256).max;
        return (l.collateral * 10000) / debt;
    }

    /// @notice Returns tracked collateral value for a loan.
    function getCollateralValue(bytes32 loanId) external view returns (uint256) {
        return loans[loanId].collateral;
    }

    /// @notice Placeholder PnL hook for milestone policy.
    function getLoanPnl(bytes32) external pure returns (int256) {
        return 0;
    }

    // Flow compatibility: pulls additional USDC collateral value.
    function pullAdditionalCollateral(bytes32 loanId, uint256 additionalCollateral) external onlyLoanManager {
        VaultLoan storage l = loans[loanId];
        require(l.active && !l.liquidated, "inactive");
        require(_pull(l.agent, additionalCollateral), "transfer failed");
        loanCollaterals[loanId].push(TokenCollateral({token: address(usdc), amount: additionalCollateral}));
        l.collateral += additionalCollateral;
        emit CollateralAdded(loanId, address(usdc), additionalCollateral, additionalCollateral);
    }

    function withdrawProtocolReserves(uint256 amount, address to) external onlyLoanManager {
        require(amount <= protocolReserves, "insufficient reserves");
        protocolReserves -= amount;
        require(_push(to, amount), "transfer failed");
    }

    function _returnAllCollateral(bytes32 loanId, address to) internal {
        TokenCollateral[] storage cols = loanCollaterals[loanId];
        for (uint256 i = 0; i < cols.length; i++) {
            require(IERC20Like(cols[i].token).transfer(to, cols[i].amount), "collateral return failed");
        }
    }

    function _pull(address from, uint256 amount) internal returns (bool) {
        return usdc.transferFrom(from, address(this), amount);
    }

    function _push(address to, uint256 amount) internal returns (bool) {
        return usdc.transfer(to, amount);
    }

    function _valueOf(address token, uint256 amount) internal view returns (uint256) {
        return (amount * tokenPrice[token]) / 1e18;
    }
}
