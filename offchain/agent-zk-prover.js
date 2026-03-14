// agent-zk-prover.js (run by agent, not oracle)
const { groth16 } = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const axios = require('axios');
const { ethers } = require('ethers');

class AgentZKProver {
  constructor(oracleUrl) {
    this.oracleUrl = oracleUrl;
    this.poseidon = null;
  }
  
  async init() {
    this.poseidon = await buildPoseidon();
  }
  
  async generateZKScoreProof(agentAddress, proxyAddress) {
    // 1. Fetch merkle proof from oracle
    const { data: merkleProof } = await axios.get(
      `${this.oracleUrl}/merkle-proof/${agentAddress}`
    );
    
    // 2. Prepare witness inputs for Circom
    const witness = {
      // Private inputs (hidden in proof)
      proxyField: BigInt(merkleProof.proxyField),
      totalVolume: BigInt(merkleProof.stats.totalVolume),
      totalPnl: BigInt(merkleProof.stats.totalPnl),
      tradeCount: BigInt(merkleProof.stats.tradeCount),
      pathElements: merkleProof.pathElements.map(BigInt),
      pathIndices: merkleProof.pathIndices,
      
      // Public inputs (revealed on-chain)
      score: this.calculateScore(merkleProof.stats), // 300-850
      merkleRoot: BigInt(merkleProof.root),
      nullifier: this.generateNullifier(proxyAddress, agentAddress)
    };
    
    // 3. Generate Groth16 proof
    const { proof, publicSignals } = await groth16.fullProve(
      witness,
      'polymarket_history.wasm',     // Circom compiled
      'polymarket_history.zkey'      // Trusted setup
    );
    
    // 4. Return for contract submission
    return {
      proof: this.serializeProof(proof),
      publicSignals, // [score, merkleRoot, nullifier]
      rootSignature: merkleProof.rootSignature
    };
  }
  
  calculateScore(stats) {
    let score = 300;
    score += Math.min(100, Math.log10(Number(stats.totalVolume) + 1) * 20);
    score += stats.totalPnl > 0 ? 100 : 50;
    score += Math.min(200, Number(stats.tradeCount) / 10);
    return Math.min(850, Math.max(300, Math.round(score)));
  }
  
  generateNullifier(proxyAddress, agentAddress) {
    // Deterministic but unique per agent-proxy pair
    return BigInt(ethers.keccak256(
      ethers.solidityPacked(['address', 'address', 'uint256'], 
      [proxyAddress, agentAddress, 12345]))
    );
  }
  
  serializeProof(proof) {
    // Flatten for Solidity
    return [
      proof.pi_a[0], proof.pi_a[1],
      proof.pi_b[0][0], proof.pi_b[0][1], proof.pi_b[1][0], proof.pi_b[1][1],
      proof.pi_c[0], proof.pi_c[1]
    ];
  }
}

// Usage
const prover = new AgentZKProver('http://localhost:8787');
await prover.init();

const { proof, publicSignals, rootSignature } = await prover.generateZKScoreProof(
  '0xAgent...',
  '0xProxy...'
);

// Submit to ZKCreditVerifier contract
await zkCreditVerifier.submitZKScore(proof, publicSignals, rootSignature);