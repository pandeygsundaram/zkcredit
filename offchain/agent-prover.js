const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const { buildPoseidon } = require('circomlibjs');

/**
 * agent-prover.js
 * - fetches own activity + daily Merkle proof from oracle-server
 * - builds witness input for polymarket_history.circom
 * - runs Groth16 locally with snarkjs
 * - emits calldata-ready arguments for ZKCreditVerifier.submitZKScore(...)
 */

async function fetchHistory(subgraph, proxyAddress) {
  const query = `query($user: String!) { userActivities(where:{user:$user}){ volume profit timestamp } }`;
  const out = await axios.post(subgraph, { query, variables: { user: proxyAddress.toLowerCase() } });
  return out.data?.data?.userActivities || [];
}

function buildCircuitInput({ proxyField, activities, pathElements, pathIndices }) {
  const MAX = 32;
  const DEPTH = 20;

  const volumes = Array(MAX).fill('0');
  const pnls = Array(MAX).fill('0');
  const timestamps = Array(MAX).fill('0');

  for (let i = 0; i < Math.min(MAX, activities.length); i++) {
    volumes[i] = String(Math.max(0, Number(activities[i].volume || 0)));
    pnls[i] = String(Math.max(0, Number(activities[i].profit || 0)));
    timestamps[i] = String(Number(activities[i].timestamp || 0));
  }

  const elements = Array(DEPTH).fill('0');
  const indices = Array(DEPTH).fill('0');
  for (let i = 0; i < Math.min(DEPTH, pathElements.length); i++) {
    elements[i] = String(pathElements[i]);
  }
  for (let i = 0; i < Math.min(DEPTH, pathIndices.length); i++) {
    indices[i] = String(pathIndices[i]);
  }

  return {
    proxy: String(proxyField),
    volumes,
    pnls,
    timestamps,
    pathElements: elements,
    pathIndices: indices
  };
}

function scoreFromActivities(activities) {
  const totalVolume = activities.reduce((a, x) => a + Math.max(0, Number(x.volume || 0)), 0);
  const totalPnl = activities.reduce((a, x) => a + Math.max(0, Number(x.profit || 0)), 0);
  const tradeCount = activities.reduce((a, x) => a + (Number(x.timestamp || 0) > 0 ? 1 : 0), 0);

  let volumeTerm = 0;
  if (totalVolume >= 1_000_000) volumeTerm += 20;
  if (totalVolume >= 10_000_000) volumeTerm += 30;
  if (totalVolume >= 100_000_000) volumeTerm += 50;

  let pnlTerm = 0;
  if (totalPnl >= 100_000) pnlTerm += 30;
  if (totalPnl >= 500_000) pnlTerm += 50;
  if (totalPnl >= 1_000_000) pnlTerm += 70;

  let tradeTerm = 0;
  if (tradeCount >= 10) tradeTerm += 20;
  if (tradeCount >= 50) tradeTerm += 30;
  if (tradeCount >= 100) tradeTerm += 30;

  let score = 300 + volumeTerm + pnlTerm + tradeTerm;
  if (score < 300) score = 300;
  if (score > 850) score = 850;
  return score;
}

function runSnarkjs({ inputPath, wasmPath, zkeyPath, witnessPath, proofPath, publicPath }) {
  execSync(`snarkjs wtns calculate ${wasmPath} ${inputPath} ${witnessPath}`, { stdio: 'inherit' });
  execSync(`snarkjs groth16 prove ${zkeyPath} ${witnessPath} ${proofPath} ${publicPath}`, { stdio: 'inherit' });
}

function toSolidityProofCall(proof, publicSignals) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
    publicSignals
  };
}

async function main() {
  const cfg = {
    agentAddress: process.env.AGENT_ADDRESS,
    proxyAddress: process.env.PROXY_ADDRESS,
    subgraph: process.env.POLYMARKET_SUBGRAPH,
    oracleBase: process.env.ORACLE_BASE_URL || 'http://localhost:8787',
    wasmPath: process.env.CIRCUIT_WASM,
    zkeyPath: process.env.CIRCUIT_ZKEY
  };

  if (!cfg.agentAddress || !cfg.proxyAddress || !cfg.subgraph || !cfg.wasmPath || !cfg.zkeyPath) {
    throw new Error('Missing env. Required: AGENT_ADDRESS, PROXY_ADDRESS, POLYMARKET_SUBGRAPH, CIRCUIT_WASM, CIRCUIT_ZKEY');
  }

  const activities = await fetchHistory(cfg.subgraph, cfg.proxyAddress);
  const proofResp = await axios.get(`${cfg.oracleBase}/merkle-proof/${cfg.agentAddress}`);
  const input = buildCircuitInput({
    proxyField: proofResp.data.proxyField,
    activities,
    pathElements: proofResp.data.pathElements,
    pathIndices: proofResp.data.pathIndices
  });

  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const score = scoreFromActivities(activities);
  const merkleRoot = BigInt(proofResp.data.root);
  const nullifier = BigInt(F.toObject(poseidon([BigInt(proofResp.data.proxyField), merkleRoot])));

  input.score = String(score);
  input.merkleRoot = merkleRoot.toString();
  input.nullifier = nullifier.toString();

  fs.writeFileSync('input.json', JSON.stringify(input, null, 2));
  runSnarkjs({
    inputPath: 'input.json',
    wasmPath: cfg.wasmPath,
    zkeyPath: cfg.zkeyPath,
    witnessPath: 'witness.wtns',
    proofPath: 'proof.json',
    publicPath: 'public.json'
  });

  const proof = JSON.parse(fs.readFileSync('proof.json', 'utf8'));
  const publicSignals = JSON.parse(fs.readFileSync('public.json', 'utf8'));
  const call = toSolidityProofCall(proof, publicSignals);

  console.log(JSON.stringify({
    root: proofResp.data.root,
    rootSignature: proofResp.data.rootSignature,
    solidityCall: call
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
