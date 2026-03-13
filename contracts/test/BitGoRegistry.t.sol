// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";

contract BitGoRegistryTest is Test {
    BitGoRegistry internal registry;

    uint256 internal ownerPk = 0xD00D;
    uint256 internal agentPk = 0xA11CE;
    uint256 internal bitGoPk = 0xC0DE;
    uint256 internal stealthPk = 0xB0B;

    address internal owner;
    address internal agent;
    address internal stealth;
    address internal bitGoSigner;

    function setUp() external {
        owner = vm.addr(ownerPk);
        agent = vm.addr(agentPk);
        stealth = vm.addr(stealthPk);
        bitGoSigner = vm.addr(bitGoPk);

        vm.prank(owner);
        registry = new BitGoRegistry(bitGoSigner);
    }

    function testRegisterWallet() external {
        bytes32 walletId = keccak256("wallet-1");
        bytes memory sig = _walletSig(agent, walletId, bitGoPk);

        vm.prank(agent);
        registry.registerWallet(walletId, sig);

        assertEq(registry.walletIds(agent), walletId);
    }

    function testLinkStealthAddress() external {
        bytes32 walletId = keccak256("wallet-2");
        bytes memory walletSig = _walletSig(agent, walletId, bitGoPk);

        vm.prank(agent);
        registry.registerWallet(walletId, walletSig);

        bytes32 loanId = keccak256("loan-1");
        bytes memory att = _attestationSig(walletId, stealth, loanId, 0, bitGoPk);

        vm.prank(agent);
        registry.linkStealthAddress(loanId, stealth, att);

        assertEq(registry.loanStealth(loanId), stealth);
        assertEq(registry.stealthToAgent(stealth), agent);
    }

    function testOnlyLoanManagerLinkForAgent() external {
        vm.prank(owner);
        registry.setLoanManager(address(this));

        bytes32 walletId = keccak256("wallet-3");
        bytes memory walletSig = _walletSig(agent, walletId, bitGoPk);

        registry.registerWalletFor(agent, walletId, walletSig);

        bytes32 loanId = keccak256("loan-3");
        bytes memory att = _attestationSig(walletId, stealth, loanId, 0, bitGoPk);
        registry.linkStealthAddressFor(agent, loanId, stealth, att);

        assertEq(registry.loanStealth(loanId), stealth);
    }

    function testCompatibilityAliasesAndRegisterStealthAddress() external {
        bytes32 walletId = keccak256("wallet-compat");
        bytes memory walletSig = _walletSig(agent, walletId, bitGoPk);

        vm.prank(agent);
        registry.registerWallet(walletId, walletSig);

        bytes32 loanId = keccak256("loan-compat");
        bytes memory att = _attestationSig(walletId, stealth, loanId, 0, bitGoPk);
        vm.prank(agent);
        registry.registerStealthAddress(loanId, stealth, att);

        assertEq(registry.bitGoWalletIds(agent), walletId);
        assertEq(registry.activeStealthAddress(agent), stealth);
        assertEq(registry.loanStealthAddress(loanId), stealth);
        assertTrue(registry.validAttestations(keccak256(att)));
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
