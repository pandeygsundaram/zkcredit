// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";

contract BitGoRegistryTest is Test {
    BitGoRegistry internal registry;

    uint256 internal agentPk = 0xA11CE;
    uint256 internal verifierPk = 0xC0DE;
    address internal agent;

    function setUp() external {
        agent = vm.addr(agentPk);
        registry = new BitGoRegistry(vm.addr(verifierPk));
    }

    function testLinkBitGoWallet() external {
        bytes32 walletId = keccak256("wallet-1");
        bytes memory att = _walletAtt(agent, walletId, verifierPk);

        vm.prank(agent);
        registry.linkBitGoWallet(walletId, att);

        assertEq(registry.getWallet(agent), walletId);
        assertTrue(registry.isBitGoVerified(agent));
    }

    function _walletAtt(address who, bytes32 walletId, uint256 signerPk) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, block.chainid, address(registry)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
