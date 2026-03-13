#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require('circomlibjs');

const MAX_TRADES = 32;
const DEPTH = 20;

function computeScore(totalVolume, totalPnl, tradeCount) {
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

async function main() {
  const outPath = process.argv[2] || path.join(process.cwd(), 'zk', 'input.example.json');
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const proxy = BigInt('0x1111111111111111111111111111111111111111');

  const volumes = Array(MAX_TRADES).fill(0);
  const pnls = Array(MAX_TRADES).fill(0);
  const timestamps = Array(MAX_TRADES).fill(0);

  // 3 used trades
  volumes[0] = 5000000;
  volumes[1] = 3000000;
  volumes[2] = 4000000;
  pnls[0] = 100000;
  pnls[1] = 200000;
  pnls[2] = 250000;
  timestamps[0] = 1700000000;
  timestamps[1] = 1700003600;
  timestamps[2] = 1700007200;

  const totalVolume = volumes[0] + volumes[1] + volumes[2];
  const totalPnl = pnls[0] + pnls[1] + pnls[2];
  const tradeCount = 3;

  const leaf = BigInt(F.toObject(poseidon([proxy, BigInt(totalVolume), BigInt(totalPnl), BigInt(tradeCount)])));

  // Simple zero-sibling tree path (for local witness smoke tests).
  const pathElements = Array(DEPTH).fill('0');
  const pathIndices = Array(DEPTH).fill('0');

  let root = leaf;
  for (let i = 0; i < DEPTH; i++) {
    root = BigInt(F.toObject(poseidon([root, 0n])));
  }

  const score = computeScore(totalVolume, totalPnl, tradeCount);
  const nullifier = BigInt(F.toObject(poseidon([proxy, root])));

  const payload = {
    proxy: proxy.toString(),
    volumes: volumes.map(String),
    pnls: pnls.map(String),
    timestamps: timestamps.map(String),
    pathElements,
    pathIndices,
    score: String(score),
    merkleRoot: root.toString(),
    nullifier: nullifier.toString()
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

