// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {ZKCreditResolver} from "../src/ZKCreditResolver.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract LoanFlowIntegrationTest is Test {
    uint256 internal constant U = 1e6;

    MockERC20 internal usdc;
    MockERC20 internal weth;
    CreditVerifier internal verifier;
    CollateralVault internal vault;
    BitGoRegistry internal bitgo;
    ZKCreditResolver internal resolver;
    LoanManager internal manager;

    uint256 internal agentPk = 0xA11CE;
    uint256 internal stealthPk = 0xB0B;
    uint256 internal bitGoPk = 0xC0DE;
    address internal agent;
    address internal stealth;
    address internal keeper = address(0xCAFE);

    function setUp() external {
        agent = vm.addr(agentPk);
        stealth = vm.addr(stealthPk);

        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        weth = new MockERC20("Mock WETH", "mWETH", 6);
        verifier = new CreditVerifier();
        vault = new CollateralVault(address(usdc));
        bitgo = new BitGoRegistry(vm.addr(bitGoPk));
        resolver = new ZKCreditResolver();
        manager = new LoanManager(address(verifier), address(vault), address(bitgo), address(resolver));

        vault.setSupportedToken(address(weth), true, 1e18);
        vault.setLoanManager(address(manager));

        resolver.setController(address(manager), true);
        manager.setAssetQuality(address(weth), 12000);
        bitgo.setLoanManager(address(manager));
        verifier.setScorer(address(manager), true);

        verifier.setAxiomQueryAddress(address(0x1234));

        usdc.mint(address(vault), 5_000_000 * U);

        usdc.mint(agent, 100_000 * U);
        weth.mint(agent, 100_000 * U);
        usdc.mint(stealth, 100_000 * U);

        vm.startPrank(agent);
        usdc.approve(address(vault), type(uint256).max);
        weth.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        vm.prank(stealth);
        usdc.approve(address(vault), type(uint256).max);

        bytes32 walletId = keccak256("bg");
        bytes memory walletSig = _walletSig(agent, walletId, bitGoPk);
        vm.prank(agent);
        bitgo.registerWallet(walletId, walletSig);

        _verifyScoreAsAgent(agent, 800, hex"abcd");
    }

    function testOpenLoanAndRepayFullFlowMultiAsset() external {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10_000 * U;
        amounts[1] = 10_000 * U;

        bytes32 loanId = _openLoan(agent, tokens, amounts, 4_000 * U, stealth, bitGoPk);

        (, , , , , , , , , uint8 phase1, , bool active1, , ) = manager.loans(loanId);
        assertTrue(active1);
        assertEq(uint256(phase1), 1);

        vm.warp(block.timestamp + 7 days);
        vm.prank(agent);
        manager.progressMilestone(loanId);

        (, , , , , , , , , uint8 phase2, , , , ) = manager.loans(loanId);
        assertEq(uint256(phase2), 2);

        uint256 debt = vault.getCurrentDebt(loanId);
        vm.prank(stealth);
        manager.repay(loanId, debt);

        (, , , , , , , , , , , bool active2, bool repaid, ) = manager.loans(loanId);
        assertFalse(active2);
        assertTrue(repaid);

        bytes32 node = keccak256(abi.encodePacked(agent));
        assertEq(resolver.text(node, "zkcredit.activeLoan"), "false");
    }

    function testLiquidationPath() external {
        verifier.setScore(agent, 300, 12000);

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 40_000 * U;

        bytes32 loanId = _openLoan(agent, tokens, amounts, 14_000 * U, stealth, bitGoPk);
        vm.warp(block.timestamp + 6 * 365 days);

        uint256 keeperBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        vault.liquidate(loanId);

        (, , , , , , , , , , , bool active, , bool liquidated) = manager.loans(loanId);
        assertTrue(liquidated);
        assertFalse(active);

        uint256 keeperAfter = usdc.balanceOf(keeper);
        assertGt(keeperAfter, keeperBefore);
    }

    function testFlowCompatibleGetQuoteFunction() external {
        address[] memory assets = new address[](2);
        assets[0] = address(usdc);
        assets[1] = address(weth);
        uint256[] memory values = new uint256[](2);
        values[0] = 10_000 * U;
        values[1] = 10_000 * U;

        vm.prank(agent);
        (uint256 maxLoan, uint256 collateralRequired, uint8 tier) = manager.getQuote(5_000 * U, assets, values);

        assertGt(maxLoan, 0);
        assertGt(collateralRequired, 0);
        assertLe(tier, 5);
    }

    function testTriggerDefaultFlowCompatibility() external {
        verifier.setScore(agent, 300, 12000);

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 40_000 * U;

        bytes32 loanId = _openLoan(agent, tokens, amounts, 14_000 * U, stealth, bitGoPk);
        vm.warp(block.timestamp + 6 * 365 days);

        vm.prank(keeper);
        manager.triggerDefault(loanId, "compat-default");

        (, , , , , , , , , , , bool active, , bool liquidated) = manager.loans(loanId);
        assertFalse(active);
        assertTrue(liquidated);
    }

    function _verifyScoreAsAgent(address who, uint256 volume, bytes memory proof) internal {
        address[] memory held = new address[](1);
        held[0] = address(usdc);

        CreditVerifier.ProofInputs memory inputs = CreditVerifier.ProofInputs({
            proxyAddress: who,
            tradeVolume: volume,
            tradeCount: 20,
            realizedPnl: 100_000,
            unrealizedPnl: 50_000,
            maxDrawdownBps: 300,
            daysActive: 365,
            volatilityScore: 2000,
            timestamp: block.timestamp,
            axiomQueryId: bytes32(uint256(1)),
            heldAssets: held
        });

        vm.prank(who);
        verifier.verifyAndScore(proof, inputs);
    }

    function _openLoan(
        address loanAgent,
        address[] memory collateralTokens,
        uint256[] memory collateralAmounts,
        uint256 principal,
        address stealthAddress,
        uint256 bitGoSignerPk
    ) internal returns (bytes32) {
        bytes32 predictedLoanId = keccak256(abi.encodePacked(loanAgent, block.chainid, manager.loanCounter() + 1));
        bytes32 walletId = bitgo.walletIds(loanAgent);
        bytes memory att = _attestationSig(walletId, stealthAddress, predictedLoanId, 0, bitGoSignerPk);

        vm.prank(loanAgent);
        bytes32 actual = manager.openLoan(collateralTokens, collateralAmounts, principal, stealthAddress, att);
        assertEq(actual, predictedLoanId);
        return actual;
    }

    function _walletSig(address who, bytes32 walletId, uint256 signerPk) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, block.chainid));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _attestationSig(bytes32 walletId, address stealthAddr, bytes32 loanId, uint256 nonce, uint256 signerPk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(walletId, stealthAddr, loanId, nonce, block.chainid));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
