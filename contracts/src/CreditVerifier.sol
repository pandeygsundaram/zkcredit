// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {BitGoRegistry} from "./BitGoRegistry.sol";

/**
 * @title CreditVerifier
 * @notice Trusted-oracle credit scoring for zkCredit (off-chain oracle + optional BitGo bonus).
 */
contract CreditVerifier {
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;
    uint256 public constant SCORE_VALIDITY = 7 days;

    address public owner;
    address public oracleSigner;
    BitGoRegistry public immutable bitGoRegistry;
    mapping(address => bool) public scorers;

    struct ScoreRecord {
        uint256 score;
        uint256 leverageBps;
        uint256 updatedAt;
    }

    mapping(address => ScoreRecord) public latestRecords;
    mapping(address => uint256) public latestScores;
    mapping(address => uint256) public scoreTimestamp;
    mapping(bytes32 => bool) public usedProofHashes;

    event OracleSignerUpdated(address indexed signer);
    event ScorerUpdated(address indexed scorer, bool allowed);
    event ScoreSubmitted(address indexed agent, uint256 score, uint8 tier, uint256 leverageBps, bytes32 proofHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyScorer() {
        require(scorers[msg.sender], "only scorer");
        _;
    }

    constructor(address oracleSigner_, address bitgoRegistry_) {
        require(oracleSigner_ != address(0), "invalid oracle");
        owner = msg.sender;
        oracleSigner = oracleSigner_;
        bitGoRegistry = BitGoRegistry(bitgoRegistry_);
        scorers[msg.sender] = true;
    }

    /// @notice Updates trusted oracle signer used for score attestations.
    /// @param signer New oracle signer address.
    function setOracleSigner(address signer) external onlyOwner {
        require(signer != address(0), "invalid oracle");
        oracleSigner = signer;
        emit OracleSignerUpdated(signer);
    }

    /// @notice Grants or revokes scorer role (used by LoanManager for bonus/penalty updates).
    /// @param scorer Address to update.
    /// @param allowed Whether scorer role is enabled.
    function setScorer(address scorer, bool allowed) external onlyOwner {
        scorers[scorer] = allowed;
        emit ScorerUpdated(scorer, allowed);
    }

    /// @notice Submits a score signed by off-chain trusted oracle.
    /// @param agent Agent receiving the score.
    /// @param score Raw score (300-850).
    /// @param leverageBps Leverage multiplier in bps.
    /// @param proofHash Uniqueness hash to prevent replay.
    /// @param issuedAt Oracle attestation timestamp.
    /// @param oracleSignature Oracle ECDSA signature.
    function submitScore(
        address agent,
        uint256 score,
        uint256 leverageBps,
        bytes32 proofHash,
        uint256 issuedAt,
        bytes calldata oracleSignature
    ) external {
        require(agent != address(0), "invalid agent");
        require(score >= MIN_SCORE && score <= MAX_SCORE, "score out of range");
        require(leverageBps >= 8000 && leverageBps <= 12000, "invalid leverage");
        require(!usedProofHashes[proofHash], "proof used");
        require(block.timestamp <= issuedAt + 1 hours, "stale attestation");

        bytes32 message = keccak256(
            abi.encodePacked(address(this), block.chainid, agent, score, leverageBps, proofHash, issuedAt)
        );
        require(_recoverSigner(message, oracleSignature) == oracleSigner, "invalid oracle signature");

        // Hybrid bonus: institutional BitGo-verified agents get +25 score cap to 850.
        if (bitGoRegistry.isBitGoVerified(agent)) {
            score = score + 25;
            if (score > MAX_SCORE) score = MAX_SCORE;
        }

        usedProofHashes[proofHash] = true;
        _storeScore(agent, score, leverageBps);
        emit ScoreSubmitted(agent, score, scoreToTier(score), leverageBps, proofHash);
    }

    /// @notice Returns whether an agent has a non-expired score record.
    /// @param agent Agent address.
    function isScoreValid(address agent) external view returns (bool) {
        uint256 ts = latestRecords[agent].updatedAt;
        return ts != 0 && block.timestamp <= ts + SCORE_VALIDITY;
    }

    /// @notice Maps score to risk tier.
    /// @param score Credit score.
    function scoreToTier(uint256 score) public pure returns (uint8) {
        if (score >= 800) return 5;
        if (score >= 740) return 4;
        if (score >= 670) return 3;
        if (score >= 580) return 2;
        if (score >= 500) return 1;
        return 0;
    }

    /// @notice Returns max LTV for a tier.
    /// @param tier Risk tier.
    function tierToLtvBps(uint8 tier) public pure returns (uint256) {
        if (tier == 5) return 9000;
        if (tier == 4) return 8500;
        if (tier == 3) return 7500;
        if (tier == 2) return 6000;
        if (tier == 1) return 4500;
        return 3000;
    }

    /// @notice Returns APR for a tier.
    /// @param tier Risk tier.
    function tierToAprBps(uint8 tier) public pure returns (uint256) {
        if (tier == 5) return 400;
        if (tier == 4) return 600;
        if (tier == 3) return 900;
        if (tier == 2) return 1400;
        if (tier == 1) return 2000;
        return 3000;
    }

    /// @notice Applies default penalty to agent score.
    /// @param agent Agent address.
    function applyDefaultPenalty(address agent) external onlyScorer {
        uint256 score = latestRecords[agent].score;
        if (score == 0) return;
        uint256 next = score > 100 ? score - 100 : MIN_SCORE;
        if (next < MIN_SCORE) next = MIN_SCORE;
        _storeScore(agent, next, latestRecords[agent].leverageBps == 0 ? 10000 : latestRecords[agent].leverageBps);
    }

    /// @notice Applies repayment bonus to agent score.
    /// @param agent Agent address.
    function applyRepaymentBonus(address agent) external onlyScorer {
        uint256 score = latestRecords[agent].score;
        if (score == 0) return;
        uint256 next = score + 25;
        if (next > MAX_SCORE) next = MAX_SCORE;
        _storeScore(agent, next, latestRecords[agent].leverageBps == 0 ? 10000 : latestRecords[agent].leverageBps);
    }

    function _storeScore(address agent, uint256 score, uint256 leverageBps) internal {
        latestRecords[agent] = ScoreRecord({score: score, leverageBps: leverageBps, updatedAt: block.timestamp});
        latestScores[agent] = score;
        scoreTimestamp[agent] = block.timestamp;
    }

    function _recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "bad sig length");
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
