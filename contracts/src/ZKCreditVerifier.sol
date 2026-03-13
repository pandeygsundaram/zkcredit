// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CreditVerifier} from "./CreditVerifier.sol";

interface IPolymarketGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[] calldata pubSignals
    ) external view returns (bool);
}

/**
 * @title ZKCreditVerifier
 * @notice Verifies Groth16 proofs for Polymarket history and syncs score into CreditVerifier.
 * @dev Public signals layout: [score, merkleRoot, nullifier].
 */
contract ZKCreditVerifier {
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;

    address public owner;
    address public oracleSigner;

    IPolymarketGroth16Verifier public immutable groth16Verifier;
    CreditVerifier public immutable creditVerifier;

    mapping(uint256 => bool) public acceptedMerkleRoots;
    mapping(uint256 => bool) public usedNullifiers;
    mapping(bytes32 => bool) public usedProofHashes;

    // Optional audit metadata (never stores proxy or raw trades).
    mapping(address => uint256) public latestZkScore;
    mapping(address => uint256) public latestNullifier;
    mapping(address => bytes32) public latestProofHash;

    event OracleSignerUpdated(address indexed signer);
    event MerkleRootUpdated(uint256 indexed root, bool accepted);
    event ZKScoreSubmitted(address indexed agent, uint256 score, uint256 merkleRoot, uint256 nullifier, bytes32 proofHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address groth16_, address creditVerifier_, address oracleSigner_) {
        require(groth16_ != address(0), "invalid groth16");
        require(creditVerifier_ != address(0), "invalid credit verifier");
        require(oracleSigner_ != address(0), "invalid oracle signer");

        owner = msg.sender;
        groth16Verifier = IPolymarketGroth16Verifier(groth16_);
        creditVerifier = CreditVerifier(creditVerifier_);
        oracleSigner = oracleSigner_;
    }

    /// @notice Updates oracle signer used for merkle-root attestations.
    function setOracleSigner(address signer) external onlyOwner {
        require(signer != address(0), "invalid signer");
        oracleSigner = signer;
        emit OracleSignerUpdated(signer);
    }

    /// @notice Allows owner to pre-accept/revoke merkle roots.
    function setAcceptedMerkleRoot(uint256 root, bool accepted) external onlyOwner {
        acceptedMerkleRoots[root] = accepted;
        emit MerkleRootUpdated(root, accepted);
    }

    /**
     * @notice Verifies ZK proof and submits score to CreditVerifier.
     * @param pA Groth16 proof A.
     * @param pB Groth16 proof B.
     * @param pC Groth16 proof C.
     * @param publicSignals [score, merkleRoot, nullifier].
     * @param oracleSignature Oracle signature over merkle root context.
     */
    function submitZKScore(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[] calldata publicSignals,
        bytes calldata oracleSignature
    ) external {
        require(publicSignals.length >= 3, "bad public signals");

        uint256 score = publicSignals[0];
        uint256 merkleRoot = publicSignals[1];
        uint256 nullifier = publicSignals[2];

        require(score >= MIN_SCORE && score <= MAX_SCORE, "score out of range");
        require(!usedNullifiers[nullifier], "nullifier used");

        // Root must be accepted either by explicit mapping or by fresh oracle signature.
        require(_isMerkleRootAuthorized(merkleRoot, oracleSignature), "unauthorized root");

        bool ok = groth16Verifier.verifyProof(pA, pB, pC, publicSignals);
        require(ok, "invalid zk proof");

        bytes32 proofHash = keccak256(abi.encodePacked(msg.sender, pA, pB, pC, publicSignals));
        require(!usedProofHashes[proofHash], "proof reused");

        usedNullifiers[nullifier] = true;
        usedProofHashes[proofHash] = true;

        latestZkScore[msg.sender] = score;
        latestNullifier[msg.sender] = nullifier;
        latestProofHash[msg.sender] = proofHash;

        // 1.0x leverage by default for ZK path; can be tuned later by policy.
        creditVerifier.setScore(msg.sender, score, 10000);

        emit ZKScoreSubmitted(msg.sender, score, merkleRoot, nullifier, proofHash);
    }

    function _isMerkleRootAuthorized(uint256 merkleRoot, bytes memory oracleSignature) internal view returns (bool) {
        if (acceptedMerkleRoots[merkleRoot]) return true;

        // Message: this contract + chainid + root
        bytes32 msgHash = keccak256(abi.encodePacked(address(this), block.chainid, merkleRoot));
        return _recoverSigner(msgHash, oracleSignature) == oracleSigner;
    }

    function _recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        return ecrecover(digest, v, r, s);
    }
}
