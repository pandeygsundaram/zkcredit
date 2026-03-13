// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {StealthRegistry} from "../src/StealthRegistry.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";

contract StealthRegistryTest is Test {
    StealthRegistry internal registry;
    BitGoRegistry internal bitgo;

    uint256 internal agentPk = 0xA11CE;
    uint256 internal stealthPk = 0xB0B;
    uint256 internal bitGoVerifierPk = 0xC0DE;
    address internal agent;
    address internal stealth;

    function setUp() external {
        agent = vm.addr(agentPk);
        stealth = vm.addr(stealthPk);

        bitgo = new BitGoRegistry(vm.addr(bitGoVerifierPk));
        registry = new StealthRegistry(address(bitgo));

        vm.prank(agent);
        registry.registerMetaAddress(bytes32(uint256(1)));
    }

    function testLinkStealthAddressSelf() external {
        bytes32 loanId = keccak256("loan-self");
        bytes memory sig = _selfSig(agent, loanId, stealthPk);

        vm.prank(agent);
        registry.linkStealthAddressSelf(stealth, loanId, sig);

        assertEq(registry.stealthToAgent(stealth), agent);
        assertEq(registry.getStealth(loanId), stealth);
    }

    function testLinkStealthAddressBitGo() external {
        bytes32 walletId = keccak256("wallet-bg");
        bytes memory walletAtt = _walletAtt(agent, walletId, bitGoVerifierPk);

        vm.prank(agent);
        bitgo.linkBitGoWallet(walletId, walletAtt);

        bytes32 loanId = keccak256("loan-bg");
        bytes memory stealthAtt = _stealthAtt(agent, walletId, loanId, stealth, bitGoVerifierPk);

        vm.prank(agent);
        registry.linkStealthAddressBitGo(loanId, stealth, stealthAtt);

        assertEq(registry.stealthToAgent(stealth), agent);
    }

    function _selfSig(address loanAgent, bytes32 loanId, uint256 signerPk) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(loanAgent, loanId, block.chainid, address(registry)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _walletAtt(address who, bytes32 walletId, uint256 signerPk) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, block.chainid, address(bitgo)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _stealthAtt(address who, bytes32 walletId, bytes32 loanId, address stealthAddr, uint256 signerPk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, loanId, stealthAddr, block.chainid, address(bitgo)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
