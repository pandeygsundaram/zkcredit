// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {ZKCreditVerifier} from "../src/ZKCreditVerifier.sol";
import {MockGroth16Verifier} from "./mocks/MockGroth16Verifier.sol";

contract ZKCreditVerifierTest is Test {
    uint256 internal oraclePk = 0xC0DE;
    address internal oracle;
    address internal agent = address(0xA11CE);

    BitGoRegistry internal bitgo;
    CreditVerifier internal credit;
    MockGroth16Verifier internal groth16;
    ZKCreditVerifier internal zk;

    function setUp() external {
        oracle = vm.addr(oraclePk);
        bitgo = new BitGoRegistry(address(0xB17));
        credit = new CreditVerifier(oracle, address(bitgo));
        groth16 = new MockGroth16Verifier();
        zk = new ZKCreditVerifier(address(groth16), address(credit), oracle);
        credit.setScorer(address(zk), true);
    }

    function testSubmitZKScoreWithSignedRoot() external {
        uint256[] memory pubSignals = new uint256[](3);
        pubSignals[0] = 780;
        pubSignals[1] = 123456789;
        pubSignals[2] = 999001;

        bytes memory rootSig = _rootSig(pubSignals[1]);
        uint256[2] memory pA = [uint256(1), uint256(2)];
        uint256[2][2] memory pB = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        uint256[2] memory pC = [uint256(7), uint256(8)];
        vm.prank(agent);
        zk.submitZKScore(pA, pB, pC, pubSignals, rootSig);

        (uint256 score, uint256 levBps, uint256 updatedAt) = credit.latestRecords(agent);
        assertEq(score, 780);
        assertEq(levBps, 10000);
        assertEq(updatedAt, block.timestamp);
        assertTrue(zk.usedNullifiers(pubSignals[2]));
    }

    function testRejectsReusedNullifier() external {
        uint256[] memory pubSignals = new uint256[](3);
        pubSignals[0] = 800;
        pubSignals[1] = 1111;
        pubSignals[2] = 2222;
        bytes memory rootSig = _rootSig(pubSignals[1]);
        uint256[2] memory pA = [uint256(1), uint256(2)];
        uint256[2][2] memory pB = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        uint256[2] memory pC = [uint256(7), uint256(8)];

        vm.prank(agent);
        zk.submitZKScore(pA, pB, pC, pubSignals, rootSig);

        vm.expectRevert("nullifier used");
        vm.prank(address(0xB0B));
        zk.submitZKScore(pA, pB, pC, pubSignals, rootSig);
    }

    function testRejectsInvalidProof() external {
        uint256[] memory pubSignals = new uint256[](3);
        pubSignals[0] = 700;
        pubSignals[1] = 3333;
        pubSignals[2] = 4444;

        groth16.setShouldVerify(false);
        uint256[2] memory pA = [uint256(1), uint256(2)];
        uint256[2][2] memory pB = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        uint256[2] memory pC = [uint256(7), uint256(8)];

        vm.expectRevert("invalid zk proof");
        vm.prank(agent);
        zk.submitZKScore(pA, pB, pC, pubSignals, _rootSig(pubSignals[1]));
    }

    function testSubmitZKScoreWithAcceptedRootNoSig() external {
        uint256[] memory pubSignals = new uint256[](3);
        pubSignals[0] = 755;
        pubSignals[1] = 7777;
        pubSignals[2] = 8888;

        zk.setAcceptedMerkleRoot(pubSignals[1], true);
        uint256[2] memory pA = [uint256(1), uint256(2)];
        uint256[2][2] memory pB = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        uint256[2] memory pC = [uint256(7), uint256(8)];

        vm.prank(agent);
        zk.submitZKScore(pA, pB, pC, pubSignals, "");

        (uint256 score,,) = credit.latestRecords(agent);
        assertEq(score, 755);
    }

    function _rootSig(uint256 root) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(address(zk), block.chainid, root));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        return abi.encodePacked(r, s, v);
    }
}
