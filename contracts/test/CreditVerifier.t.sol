// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreditVerifier} from "../src/CreditVerifier.sol";
import {BitGoRegistry} from "../src/BitGoRegistry.sol";

contract CreditVerifierTest is Test {
    CreditVerifier internal verifier;
    BitGoRegistry internal bitgo;

    uint256 internal oraclePk = 0xC0DE;
    uint256 internal bitGoPk = 0xBEEF;
    address internal oracle;
    address internal agent = address(0xA11CE);

    function setUp() external {
        oracle = vm.addr(oraclePk);
        bitgo = new BitGoRegistry(vm.addr(bitGoPk));
        verifier = new CreditVerifier(oracle, address(bitgo));
    }

    function testSubmitScoreWithOracleSignature() external {
        uint256 score = 805;
        uint256 lev = 11000;
        bytes32 proofHash = keccak256("proof-1");
        uint256 issuedAt = block.timestamp;
        bytes memory sig = _oracleSig(agent, score, lev, proofHash, issuedAt);

        verifier.submitScore(agent, score, lev, proofHash, issuedAt, sig);

        (uint256 stored,, uint256 ts) = verifier.latestRecords(agent);
        assertEq(stored, score);
        assertEq(ts, block.timestamp);
    }

    function testBitGoBonusApplied() external {
        bytes32 walletId = keccak256("wallet");
        bytes memory walletSig = _walletSig(agent, walletId);
        vm.prank(agent);
        bitgo.linkBitGoWallet(walletId, walletSig);

        uint256 score = 800;
        uint256 lev = 10000;
        bytes32 proofHash = keccak256("proof-bg");
        uint256 issuedAt = block.timestamp;
        bytes memory sig = _oracleSig(agent, score, lev, proofHash, issuedAt);

        verifier.submitScore(agent, score, lev, proofHash, issuedAt, sig);

        (uint256 stored,,) = verifier.latestRecords(agent);
        assertEq(stored, 825);
    }

    function _oracleSig(address who, uint256 score, uint256 lev, bytes32 proofHash, uint256 issuedAt)
        internal
        view
        returns (bytes memory)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(address(verifier), block.chainid, who, score, lev, proofHash, issuedAt));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _walletSig(address who, bytes32 walletId) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(who, walletId, block.chainid, address(bitgo)));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bitGoPk, digest);
        return abi.encodePacked(r, s, v);
    }
}
