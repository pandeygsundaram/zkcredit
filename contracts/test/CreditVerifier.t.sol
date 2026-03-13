// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";

contract CreditVerifierTest is Test {
    CreditVerifier internal verifier;
    address internal agent = address(0xA11CE);

    function setUp() external {
        verifier = new CreditVerifier();
    }

    function testSetScoreAndTier() external {
        verifier.setScore(agent, 805, 11500);

        (uint256 score, uint256 leverageBps, uint256 updatedAt) = verifier.latestRecords(agent);
        assertEq(score, 805);
        assertEq(leverageBps, 11500);
        assertEq(updatedAt, block.timestamp);
        assertEq(verifier.scoreToTier(score), 5);
    }

    function testVerifyAndScoreStoresResultAndPreventsReplay() external {
        verifier.setAxiomQueryAddress(address(0x1234));

        bytes memory proof = hex"123456";
        address[] memory held = new address[](1);
        held[0] = address(0);

        CreditVerifier.ProofInputs memory inputs = CreditVerifier.ProofInputs({
            proxyAddress: agent,
            tradeVolume: 5_000_000,
            tradeCount: 20,
            realizedPnl: 200_000,
            unrealizedPnl: 50_000,
            maxDrawdownBps: 500,
            daysActive: 200,
            volatilityScore: 3000,
            timestamp: block.timestamp,
            axiomQueryId: bytes32(uint256(1)),
            heldAssets: held
        });

        vm.prank(agent);
        (uint256 score,, uint256 lev) = verifier.verifyAndScore(proof, inputs);
        assertGe(score, 300);
        assertLe(score, 850);
        assertEq(lev, 12000);

        vm.prank(agent);
        vm.expectRevert("proof reused");
        verifier.verifyAndScore(proof, inputs);
    }

    function testScoreValidityExpiry() external {
        verifier.setScore(agent, 700, 10000);
        assertTrue(verifier.isScoreValid(agent));

        vm.warp(block.timestamp + 8 days);
        assertFalse(verifier.isScoreValid(agent));
    }

    function testOnlyScorerCanSetScore() external {
        vm.prank(address(0xBEEF));
        vm.expectRevert("only scorer");
        verifier.setScore(agent, 700, 10000);
    }

    function testInvalidScoreRangeReverts() external {
        vm.expectRevert("score out of range");
        verifier.setScore(agent, 299, 10000);

        vm.expectRevert("score out of range");
        verifier.setScore(agent, 851, 10000);
    }
}
