// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CreditVerifier {
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;
    uint256 public constant SCORE_VALIDITY = 7 days;

    struct ScoreRecord {
        uint256 score;
        uint256 leverageBps;
        uint256 updatedAt;
    }

    struct ProofInputs {
        address proxyAddress;
        uint256 tradeVolume;
        uint256 tradeCount;
        int256 realizedPnl;
        int256 unrealizedPnl;
        uint256 maxDrawdownBps;
        uint256 daysActive;
        uint256 volatilityScore;
        uint256 timestamp;
        bytes32 axiomQueryId;
        address[] heldAssets;
    }

    address public owner;
    mapping(address => bool) public scorers;
    mapping(address => ScoreRecord) public latestRecords;
    mapping(address => uint256) public latestScores;
    mapping(address => uint256) public scoreTimestamp;

    address public axiomQueryAddress;
    mapping(bytes32 => bool) public usedProofs;

    event ScorerUpdated(address indexed scorer, bool allowed);
    event ScoreUpdated(address indexed agent, uint256 score, uint8 tier, uint256 leverageBps);
    event AxiomQueryUpdated(address indexed axiomQuery);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyScorer() {
        require(scorers[msg.sender], "only scorer");
        _;
    }

    constructor() {
        owner = msg.sender;
        scorers[msg.sender] = true;
    }

    function setAxiomQueryAddress(address axiomQuery_) external onlyOwner {
        axiomQueryAddress = axiomQuery_;
        emit AxiomQueryUpdated(axiomQuery_);
    }

    function setScorer(address scorer, bool allowed) external onlyOwner {
        scorers[scorer] = allowed;
        emit ScorerUpdated(scorer, allowed);
    }

    function setScore(address agent, uint256 score, uint256 leverageBps) external onlyScorer {
        _storeScore(agent, score, leverageBps);
    }

    function verifyAndScore(bytes calldata proof, ProofInputs calldata inputs)
        external
        returns (uint256 score, uint8 tier, uint256 leverageBps)
    {
        bytes32 proofHash = keccak256(proof);
        require(!usedProofs[proofHash], "proof reused");
        require(_verifyAxiom(inputs.axiomQueryId, proof), "invalid proof");

        usedProofs[proofHash] = true;

        score = _calculateFromInputs(inputs);
        leverageBps = _calculateLeverage(inputs.heldAssets);
        tier = scoreToTier(score);

        latestRecords[msg.sender] = ScoreRecord({score: score, leverageBps: leverageBps, updatedAt: block.timestamp});
        latestScores[msg.sender] = score;
        scoreTimestamp[msg.sender] = block.timestamp;
        emit ScoreUpdated(msg.sender, score, tier, leverageBps);
    }

    function applyDefaultPenalty(address agent) external onlyScorer {
        uint256 score = latestRecords[agent].score;
        if (score == 0) return;
        uint256 next = score > 100 ? score - 100 : MIN_SCORE;
        if (next < MIN_SCORE) next = MIN_SCORE;
        _storeScore(agent, next, latestRecords[agent].leverageBps == 0 ? 10000 : latestRecords[agent].leverageBps);
    }

    function applyRepaymentBonus(address agent) external onlyScorer {
        uint256 score = latestRecords[agent].score;
        if (score == 0) return;
        uint256 next = score + 25;
        if (next > MAX_SCORE) next = MAX_SCORE;
        _storeScore(agent, next, latestRecords[agent].leverageBps == 0 ? 10000 : latestRecords[agent].leverageBps);
    }

    function latestScore(address agent) external view returns (uint256) {
        return latestRecords[agent].score;
    }

    function latestLeverageBps(address agent) external view returns (uint256) {
        uint256 lev = latestRecords[agent].leverageBps;
        return lev == 0 ? 10000 : lev;
    }

    function isScoreValid(address agent) external view returns (bool) {
        uint256 ts = latestRecords[agent].updatedAt;
        return ts != 0 && block.timestamp <= ts + SCORE_VALIDITY;
    }

    function scoreToTier(uint256 score) public pure returns (uint8) {
        if (score >= 800) return 5;
        if (score >= 740) return 4;
        if (score >= 670) return 3;
        if (score >= 580) return 2;
        if (score >= 500) return 1;
        return 0;
    }

    function tierToLtvBps(uint8 tier) public pure returns (uint256) {
        if (tier == 5) return 9000;
        if (tier == 4) return 8500;
        if (tier == 3) return 7500;
        if (tier == 2) return 6000;
        if (tier == 1) return 4500;
        return 3000;
    }

    function tierToAprBps(uint8 tier) public pure returns (uint256) {
        if (tier == 5) return 400;
        if (tier == 4) return 600;
        if (tier == 3) return 900;
        if (tier == 2) return 1400;
        if (tier == 1) return 2000;
        return 3000;
    }

    function _storeScore(address agent, uint256 score, uint256 leverageBps) internal {
        require(agent != address(0), "invalid agent");
        require(score >= MIN_SCORE && score <= MAX_SCORE, "score out of range");
        require(leverageBps >= 8000 && leverageBps <= 12000, "invalid leverage");

        latestRecords[agent] = ScoreRecord({score: score, leverageBps: leverageBps, updatedAt: block.timestamp});
        latestScores[agent] = score;
        scoreTimestamp[agent] = block.timestamp;
        emit ScoreUpdated(agent, score, scoreToTier(score), leverageBps);
    }

    function _verifyAxiom(bytes32, bytes calldata proof) internal view returns (bool) {
        if (axiomQueryAddress == address(0)) return false;
        return proof.length > 0;
    }

    function _calculateFromInputs(ProofInputs memory i) internal pure returns (uint256) {
        int256 base = int256(MIN_SCORE);

        base += int256(_logScale(i.tradeVolume, 1e6, 1e12, 100));
        base += int256(_signedNormalize(i.realizedPnl + i.unrealizedPnl, -1e6, 1e6, 0, 200));
        base += int256((10000 - i.volatilityScore) * 100 / 10000);
        base += int256(i.daysActive > 365 ? 50 : (i.daysActive * 50 / 365));
        base -= int256(i.maxDrawdownBps > 5000 ? 100 : (i.maxDrawdownBps * 100 / 5000));

        if (base < int256(MIN_SCORE)) return MIN_SCORE;
        if (base > int256(MAX_SCORE)) return MAX_SCORE;
        return uint256(base);
    }

    function _calculateLeverage(address[] memory heldAssets) internal pure returns (uint256) {
        if (heldAssets.length == 0) return 10000;

        uint256 weighted;
        for (uint256 i = 0; i < heldAssets.length; i++) {
            weighted += _assetQuality(heldAssets[i]);
        }
        return weighted / heldAssets.length;
    }

    function _assetQuality(address token) internal pure returns (uint256) {
        if (token == address(0)) return 12000; // treat native as high quality
        return 10000;
    }

    function _logScale(uint256 value, uint256 min, uint256 max, uint256 outMax) internal pure returns (uint256) {
        if (value <= min) return 0;
        if (value >= max) return outMax;
        return ((value - min) * outMax) / (max - min);
    }

    function _signedNormalize(int256 value, int256 min, int256 max, uint256 outMin, uint256 outMax)
        internal
        pure
        returns (uint256)
    {
        if (value <= min) return outMin;
        if (value >= max) return outMax;
        int256 spanIn = max - min;
        int256 spanOut = int256(outMax - outMin);
        int256 normalized = ((value - min) * spanOut) / spanIn;
        return outMin + uint256(normalized);
    }
}
