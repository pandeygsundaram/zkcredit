const express = require('express');
const axios = require('axios');
const { ethers } = require('ethers');
const { buildPoseidon } = require('circomlibjs');
const { FileverseClient } = require('./fileverse-client');
const { BitGoClient } = require('./bitgo-client');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8787);
const RPC_URL = process.env.RPC_URL;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const CREDIT_VERIFIER_ADDRESS = process.env.CREDIT_VERIFIER_ADDRESS;
const ZK_CREDIT_VERIFIER_ADDRESS = process.env.ZK_CREDIT_VERIFIER_ADDRESS;
const POLYMARKET_SUBGRAPH = process.env.POLYMARKET_SUBGRAPH || 'https://api.thegraph.com/subgraphs/name/polymarket/matic-markets';
const POLYMARKET_DATA_API = process.env.POLYMARKET_DATA_API || 'https://data-api.polymarket.com';
const POLYMARKET_GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';
const POLYMARKET_TIMEOUT_MS = Number(process.env.POLYMARKET_TIMEOUT_MS || 10000);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);

const verifier = new ethers.Contract(
  CREDIT_VERIFIER_ADDRESS,
  ['function submitScore(address,uint256,uint256,bytes32,uint256,bytes) external'],
  signer
);

const fileverse = new FileverseClient({ endpoint: process.env.FILEVERSE_ENDPOINT, apiKey: process.env.FILEVERSE_API_KEY });
const bitgo = new BitGoClient({ accessToken: process.env.BITGO_ACCESS_TOKEN, baseUrl: process.env.BITGO_BASE_URL });
const TREE_DEPTH = Number(process.env.ZK_TREE_DEPTH || 20);

let poseidon;
const F = {};

// Ephemeral daily state. This intentionally stores no proxy addresses.
let dailyRoot = null;
let dailyRootSignature = null;
let dailyLevels = [];
let dailyProofIndexByAgent = new Map();
let dailyProofPayloadByAgent = new Map();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function norm(v, min, max, outMin, outMax) {
  if (v <= min) return outMin;
  if (v >= max) return outMax;
  return outMin + ((v - min) * (outMax - outMin)) / (max - min);
}

async function fetchPolymarket(proxyAddress) {
  const user = proxyAddress.toLowerCase();
  const nowTs = Math.floor(Date.now() / 1000);

  const safeGet = async (baseURL, path, params, fallback) => {
    try {
      const { data } = await axios.get(`${baseURL}${path}`, { params, timeout: POLYMARKET_TIMEOUT_MS });
      return Array.isArray(data) ? data : (data || fallback);
    } catch (_) {
      return fallback;
    }
  };

  const [trades, positions, activity, valuePayload, profile] = await Promise.all([
    safeGet(POLYMARKET_DATA_API, '/trades', { user, limit: 500, offset: 0, takerOnly: true }, []),
    safeGet(POLYMARKET_DATA_API, '/positions', { user, limit: 200, offset: 0 }, []),
    safeGet(POLYMARKET_DATA_API, '/activity', { user, limit: 500, offset: 0, sortBy: 'TIMESTAMP', sortDirection: 'DESC' }, []),
    safeGet(POLYMARKET_DATA_API, '/value', { user }, []),
    safeGet(POLYMARKET_GAMMA_API, '/public-profile', { address: user }, null)
  ]);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pickFirstNum = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) {
        const n = Number(obj[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  };

  const normalized = [];

  for (const t of trades) {
    const size = toNum(t.size);
    const price = toNum(t.price);
    const volume = Math.max(0, size * price);
    const ts = Math.floor(toNum(t.timestamp)) || nowTs;
    normalized.push({ volume, profit: 0, trades: 1, timestamp: ts });
  }

  for (const a of activity) {
    if (String(a.type || '').toUpperCase() === 'TRADE') continue;
    const usdcSize = Math.abs(toNum(a.usdcSize));
    const size = Math.abs(toNum(a.size));
    const price = toNum(a.price);
    const volume = usdcSize > 0 ? usdcSize : Math.max(0, size * price);
    const ts = Math.floor(toNum(a.timestamp)) || nowTs;
    normalized.push({ volume, profit: 0, trades: 0, timestamp: ts });
  }

  for (const p of positions) {
    const unrealized = pickFirstNum(p, ['unrealizedPnl', 'unrealizedPNL', 'pnl', 'profit']);
    const realized = pickFirstNum(p, ['realizedPnl', 'realizedPNL']);
    const profit = unrealized + realized;
    normalized.push({ volume: 0, profit, trades: 0, timestamp: nowTs });
  }

  // Fetching these keeps integration aligned with public endpoints list.
  // They are currently not part of the canonical leaf metrics.
  const totalValue = Array.isArray(valuePayload)
    ? valuePayload.reduce((acc, x) => acc + toNum(x.value), 0)
    : toNum(valuePayload?.value);
  void totalValue;
  void profile;

  if (normalized.length > 0) {
    return normalized;
  }

  // Safe fallback to legacy subgraph path if Data API is unavailable.
  const query = `query($user: String!) { userActivities(where:{user:$user}){ volume profit trades timestamp } }`;
  const out = await axios.post(POLYMARKET_SUBGRAPH, { query, variables: { user } });
  return out.data?.data?.userActivities || [];
}

function calculateScore(activities) {
  const volume = activities.reduce((a, x) => a + Number(x.volume || 0), 0);
  const pnl = activities.reduce((a, x) => a + Number(x.profit || 0), 0);
  const trades = activities.reduce((a, x) => a + Number(x.trades || 0), 0);
  let score = 300;
  score += norm(volume, 1e6, 1e9, 0, 100);
  score += norm(pnl, -1e6, 1e6, 0, 200);
  score += norm(trades, 0, 2000, 0, 100);
  score += norm(activities.length, 0, 365, 0, 50);
  return Math.round(clamp(score, 300, 850));
}

function toField(v) {
  return BigInt(v);
}

function poseidonHash(inputs) {
  return BigInt(F.toObject(poseidon(inputs)));
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function buildZeroHashes(depth) {
  const zeroHashes = Array(depth + 1).fill(0n);
  zeroHashes[0] = 0n;
  for (let d = 1; d <= depth; d++) {
    zeroHashes[d] = poseidonHash([zeroHashes[d - 1], zeroHashes[d - 1]]);
  }
  return zeroHashes;
}

function buildFixedDepthTree(leaves, depth, zeroHashes) {
  if (leaves.length > (1 << depth)) {
    throw new Error(`too many leaves for depth ${depth}`);
  }

  const levels = [];
  let current = leaves.slice();

  for (let d = 0; d < depth; d++) {
    levels.push(current);
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = (i + 1 < current.length) ? current[i + 1] : zeroHashes[d];
      next.push(poseidonHash([left, right]));
    }
    if (next.length === 0) {
      next.push(poseidonHash([zeroHashes[d], zeroHashes[d]]));
    }
    current = next;
  }

  return { levels, root: current[0] };
}

function pathForIndex(levels, leafIndex, zeroHashes, depth) {
  const siblings = [];
  const indices = [];
  let idx = leafIndex;
  for (let d = 0; d < depth; d++) {
    const level = levels[d];
    const siblingIndex = idx ^ 1;
    const sibling = (level && siblingIndex < level.length) ? level[siblingIndex] : zeroHashes[d];
    siblings.push(sibling);
    indices.push(idx & 1); // 0 if left, 1 if right
    idx = Math.floor(idx / 2);
  }
  return { siblings, indices };
}

function proxyToField(proxyAddress) {
  return BigInt(proxyAddress.toLowerCase());
}

app.post('/build-merkle-tree', async (req, res) => {
  try {
    const { agents } = req.body;
    if (!Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: 'agents[] required' });
    }

    dailyProofIndexByAgent = new Map();
    dailyProofPayloadByAgent = new Map();
    const zeroHashes = buildZeroHashes(TREE_DEPTH);

    const leaves = [];
    for (let i = 0; i < agents.length; i++) {
      const { agentAddress, proxyAddress } = agents[i];
      const activities = await fetchPolymarket(proxyAddress);
      const stats = {
        totalVolume: Math.floor(activities.reduce((a, x) => a + Number(x.volume || 0), 0)),
        totalPnl: Math.floor(activities.reduce((a, x) => a + Number(x.profit || 0), 0)),
        tradeCount: Math.floor(activities.reduce((a, x) => a + (Number(x.timestamp || 0) > 0 ? 1 : 0), 0))
      };

      const proxyField = proxyToField(proxyAddress);
      const leaf = poseidonHash([proxyField, toField(stats.totalVolume), toField(stats.totalPnl), toField(stats.tradeCount)]);
      leaves.push(leaf);
      dailyProofIndexByAgent.set(agentAddress.toLowerCase(), i);
      dailyProofPayloadByAgent.set(agentAddress.toLowerCase(), { stats, proxyField: proxyField.toString() });
    }

    const built = buildFixedDepthTree(leaves, TREE_DEPTH, zeroHashes);
    dailyLevels = built.levels;
    dailyRoot = built.root;

    const chainId = (await provider.getNetwork()).chainId;
    const msgHash = ethers.keccak256(
      ethers.solidityPacked(['address', 'uint256', 'uint256'], [ZK_CREDIT_VERIFIER_ADDRESS, chainId, dailyRoot])
    );
    dailyRootSignature = await signer.signMessage(ethers.getBytes(msgHash));

    res.json({ root: dailyRoot.toString(), rootSignature: dailyRootSignature, count: agents.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/merkle-proof/:agentAddress', async (req, res) => {
  try {
    const key = req.params.agentAddress.toLowerCase();
    if (!dailyRoot || !dailyProofIndexByAgent.has(key) || !dailyProofPayloadByAgent.has(key)) {
      return res.status(404).json({ error: 'agent not in current daily tree' });
    }

    const leafIndex = dailyProofIndexByAgent.get(key);
    const payload = dailyProofPayloadByAgent.get(key);
    const path = pathForIndex(dailyLevels, leafIndex, buildZeroHashes(TREE_DEPTH), TREE_DEPTH);

    // Return proof material once and erase agent-specific ephemeral state.
    dailyProofIndexByAgent.delete(key);
    dailyProofPayloadByAgent.delete(key);

    res.json({
      root: dailyRoot.toString(),
      rootSignature: dailyRootSignature,
      pathElements: path.siblings.map((x) => x.toString()),
      pathIndices: path.indices,
      stats: payload.stats,
      proxyField: payload.proxyField
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/bitgo/status/:agentAddress', async (req, res) => {
  try {
    const status = await bitgo.getWalletStatus(req.params.agentAddress);
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/submit-score', async (req, res) => {
  try {
    const { agentAddress, proxyAddress, leverageBps = 10000 } = req.body;
    const activities = await fetchPolymarket(proxyAddress);
    const score = calculateScore(activities);
    const issuedAt = Math.floor(Date.now() / 1000);
    const proofHash = ethers.keccak256(
      ethers.solidityPacked(['address', 'address', 'uint256', 'uint256'], [agentAddress, proxyAddress, score, issuedAt])
    );

    const chainId = (await provider.getNetwork()).chainId;
    const message = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'address', 'uint256', 'uint256', 'bytes32', 'uint256'],
        [CREDIT_VERIFIER_ADDRESS, chainId, agentAddress, score, leverageBps, proofHash, issuedAt]
      )
    );
    const oracleSignature = await signer.signMessage(ethers.getBytes(message));

    const profile = await fileverse.storeAgentProfile(agentAddress, { score, proofHash, issuedAt });
    const tx = await verifier.submitScore(agentAddress, score, leverageBps, proofHash, issuedAt, oracleSignature);
    await tx.wait();

    res.json({ score, leverageBps, proofHash, fileverseCid: profile.cid, txHash: tx.hash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function main() {
  poseidon = await buildPoseidon();
  F.toObject = poseidon.F.toObject.bind(poseidon.F);
  app.listen(PORT, () => console.log(`oracle server listening on ${PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
