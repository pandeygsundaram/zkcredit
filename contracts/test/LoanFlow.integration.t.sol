// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {StealthRegistry} from "../src/StealthRegistry.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {ZKCreditResolver} from "../src/ZKCreditResolver.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract LoanFlowIntegrationTest is Test {
    uint256 internal constant U = 1e6;

    MockERC20 internal usdc;
    MockERC20 internal weth;
    BitGoRegistry internal bitgo;
    CreditVerifier internal verifier;
    StealthRegistry internal stealth;
    CollateralVault internal vault;
    ZKCreditResolver internal resolver;
    LoanManager internal manager;

    uint256 internal agentPk = 0xA11CE;
    uint256 internal stealthPk = 0xB0B;
    uint256 internal oraclePk = 0xC0DE;
    uint256 internal bitGoVerifierPk = 0xBEEF;

    address internal agent;
    address internal stealthAddr;

    function setUp() external {
        agent = vm.addr(agentPk);
        stealthAddr = vm.addr(stealthPk);

        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        weth = new MockERC20("Mock WETH", "mWETH", 6);
        bitgo = new BitGoRegistry(vm.addr(bitGoVerifierPk));
        verifier = new CreditVerifier(vm.addr(oraclePk), address(bitgo));
        stealth = new StealthRegistry(address(bitgo));
        vault = new CollateralVault(address(usdc));
        resolver = new ZKCreditResolver();
        manager = new LoanManager(address(verifier), address(vault), address(stealth), address(bitgo), address(resolver));

        vault.setSupportedToken(address(weth), true, 1e18);
        vault.setLoanManager(address(manager));
        resolver.setController(address(manager), true);
        stealth.setLoanManager(address(manager));
        verifier.setScorer(address(manager), true);
        manager.setAssetQuality(address(weth), 12000);

        usdc.mint(address(vault), 5_000_000 * U);
        usdc.mint(agent, 100_000 * U);
        weth.mint(agent, 100_000 * U);
        usdc.mint(stealthAddr, 100_000 * U);

        vm.startPrank(agent);
        usdc.approve(address(vault), type(uint256).max);
        weth.approve(address(vault), type(uint256).max);
        stealth.registerMetaAddress(bytes32(uint256(111)));
        vm.stopPrank();

        vm.prank(stealthAddr);
        usdc.approve(address(vault), type(uint256).max);

        _submitScore(agent, 800, 10000, keccak256("proof-1"));
    }

    function testOpenLoanSelfCustodyFlow() external {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10_000 * U;
        amounts[1] = 10_000 * U;

        bytes32 loanId = _openLoanSelf(agent, tokens, amounts, 4_000 * U);

        vm.warp(block.timestamp + 7 days);
        vm.prank(agent);
        manager.progressMilestone(loanId);

        uint256 debt = vault.getCurrentDebt(loanId);
        vm.prank(stealthAddr);
        manager.repay(loanId, debt);

        (, , , , , , , , , , , bool active2, bool repaid, ) = manager.loans(loanId);
        assertFalse(active2);
        assertTrue(repaid);
    }

    function testOpenLoanBitGoFlowAndResolverENS() external {
        bytes32 walletId = keccak256("wallet-bg");
        bytes memory walletAtt = _walletAtt(agent, walletId);
        vm.prank(agent);
        bitgo.linkBitGoWallet(walletId, walletAtt);

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 15_000 * U;

        bytes32 loanId = _openLoanBitGo(agent, tokens, amounts, 5_000 * U);

        bytes32 node = keccak256(abi.encodePacked(agent));
        assertEq(resolver.resolve(node), agent);
        assertEq(resolver.getText(node, "zkcredit.activeLoan"), "true");
        assertTrue(loanId != bytes32(0));
    }

    function _submitScore(address who, uint256 score, uint256 lev, bytes32 proofHash) internal {
        uint256 issuedAt = block.timestamp;
        bytes32 msgHash = keccak256(abi.encodePacked(address(verifier), block.chainid, who, score, lev, proofHash, issuedAt));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        verifier.submitScore(who, score, lev, proofHash, issuedAt, abi.encodePacked(r, s, v));
    }

    function _openLoanSelf(address loanAgent, address[] memory tokens, uint256[] memory amts, uint256 principal)
        internal
        returns (bytes32)
    {
        bytes32 loanId = keccak256(abi.encodePacked(loanAgent, block.chainid, manager.loanCounter() + 1));
        bytes memory selfSig = _selfSig(loanAgent, loanId);
        vm.prank(loanAgent);
        return manager.openLoan(tokens, amts, principal, stealthAddr, selfSig);
    }

    function _openLoanBitGo(address loanAgent, address[] memory tokens, uint256[] memory amts, uint256 principal)
        internal
        returns (bytes32)
    {
        bytes32 loanId = keccak256(abi.encodePacked(loanAgent, block.chainid, manager.loanCounter() + 1));
        bytes32 walletId = bitgo.walletIds(loanAgent);
        bytes memory att = _stealthAtt(loanAgent, walletId, loanId, stealthAddr);
        vm.prank(loanAgent);
        return manager.openLoan(tokens, amts, principal, stealthAddr, att);
    }

    function _selfSig(address who, bytes32 loanId) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, loanId, block.chainid, address(stealth)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(stealthPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _walletAtt(address who, bytes32 walletId) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, block.chainid, address(bitgo)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bitGoVerifierPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _stealthAtt(address who, bytes32 walletId, bytes32 loanId, address stealthAddress) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, loanId, stealthAddress, block.chainid, address(bitgo)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bitGoVerifierPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
