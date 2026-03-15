const express = require("express");
const axios = require("axios");
const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");
const { FileverseClient } = require("./fileverse-client");
const { BitGoClient } = require("./bitgo-client");
require("dotenv").config();

const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 8787);
const RPC_URL = process.env.RPC_URL;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const CREDIT_VERIFIER_ADDRESS =
  process.env.CREDIT_VERIFIER_ADDRESS || process.env.CREDIT_VERIFIER;
const ZK_CREDIT_VERIFIER_ADDRESS =
  process.env.ZK_CREDIT_VERIFIER_ADDRESS || process.env.ZK_CREDIT_VERIFIER;
const POLYMARKET_SUBGRAPH =
  process.env.POLYMARKET_SUBGRAPH ||
  "https://api.thegraph.com/subgraphs/name/polymarket/matic-markets";
const POLYMARKET_DATA_API =
  process.env.POLYMARKET_DATA_API || "https://data-api.polymarket.com";
const POLYMARKET_GAMMA_API =
  process.env.POLYMARKET_GAMMA_API || "https://gamma-api.polymarket.com";
const POLYMARKET_TIMEOUT_MS = Number(
  process.env.POLYMARKET_TIMEOUT_MS || 10000,
);
const LOAN_MANAGER_ADDRESS = process.env.LOAN_MANAGER_ADDRESS;

const provider = new ethers.JsonRpcProvider(RPC_URL);
if (!ORACLE_PRIVATE_KEY) {
  throw new Error("Missing ORACLE_PRIVATE_KEY in environment");
}

if (!/^0x[0-9a-fA-F]{64}$/.test(ORACLE_PRIVATE_KEY.trim())) {
  throw new Error(
    "Invalid ORACLE_PRIVATE_KEY format. Expected 0x + 64 hex characters",
  );
}

if (!RPC_URL) {
  throw new Error("Missing RPC_URL in environment");
}

if (!CREDIT_VERIFIER_ADDRESS || !ethers.isAddress(CREDIT_VERIFIER_ADDRESS)) {
  throw new Error(
    "Missing or invalid CREDIT_VERIFIER_ADDRESS (or CREDIT_VERIFIER) in environment",
  );
}

if (
  !ZK_CREDIT_VERIFIER_ADDRESS ||
  !ethers.isAddress(ZK_CREDIT_VERIFIER_ADDRESS)
) {
  throw new Error(
    "Missing or invalid ZK_CREDIT_VERIFIER_ADDRESS (or ZK_CREDIT_VERIFIER) in environment",
  );
}

const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY.trim(), provider);

const verifier = new ethers.Contract(
  CREDIT_VERIFIER_ADDRESS,
  [
    "function submitScore(address,uint256,uint256,bytes32,uint256,bytes) external",
  ],
  signer,
);

// LoanManager contract for getQuote
const LOAN_MANAGER_ABI = [
  "function getQuote(address[] calldata collateralTokens, uint256[] calldata collateralAmounts) public view returns (uint256 score, uint8 tier, uint256 aprBps, uint256 maxPrincipal)",
];

const fileverse = new FileverseClient({
  endpoint: process.env.FILEVERSE_ENDPOINT,
  apiKey: process.env.FILEVERSE_API_KEY,
});
const bitgo = new BitGoClient({
  accessToken: process.env.BITGO_ACCESS_TOKEN,
  baseUrl: process.env.BITGO_BASE_URL,
});
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

const loanManager = new ethers.Contract(
  process.env.LOAN_MANAGER_ADDRESS,
  LOAN_MANAGER_ABI,
  provider,
);

async function fetchPolymarket(proxyAddress) {
  const user = proxyAddress.toLowerCase();
  const nowTs = Math.floor(Date.now() / 1000);

  const safeGet = async (baseURL, path, params, fallback) => {
    try {
      const { data } = await axios.get(`${baseURL}${path}`, {
        params,
        timeout: POLYMARKET_TIMEOUT_MS,
      });
      return Array.isArray(data) ? data : data || fallback;
    } catch (_) {
      return fallback;
    }
  };

  const [trades, positions, activity, valuePayload, profile] =
    await Promise.all([
      safeGet(
        POLYMARKET_DATA_API,
        "/trades",
        { user, limit: 500, offset: 0, takerOnly: true },
        [],
      ),
      safeGet(
        POLYMARKET_DATA_API,
        "/positions",
        { user, limit: 200, offset: 0 },
        [],
      ),
      safeGet(
        POLYMARKET_DATA_API,
        "/activity",
        {
          user,
          limit: 500,
          offset: 0,
          sortBy: "TIMESTAMP",
          sortDirection: "DESC",
        },
        [],
      ),
      safeGet(POLYMARKET_DATA_API, "/value", { user }, []),
      safeGet(POLYMARKET_GAMMA_API, "/public-profile", { address: user }, null),
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
    if (String(a.type || "").toUpperCase() === "TRADE") continue;
    const usdcSize = Math.abs(toNum(a.usdcSize));
    const size = Math.abs(toNum(a.size));
    const price = toNum(a.price);
    const volume = usdcSize > 0 ? usdcSize : Math.max(0, size * price);
    const ts = Math.floor(toNum(a.timestamp)) || nowTs;
    normalized.push({ volume, profit: 0, trades: 0, timestamp: ts });
  }

  for (const p of positions) {
    const unrealized = pickFirstNum(p, [
      "unrealizedPnl",
      "unrealizedPNL",
      "pnl",
      "profit",
    ]);
    const realized = pickFirstNum(p, ["realizedPnl", "realizedPNL"]);
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
  const out = await axios.post(POLYMARKET_SUBGRAPH, {
    query,
    variables: { user },
  });
  return out.data?.data?.userActivities || [];
}

// Calculate Sharpe ratio from trading returns
function calculateSharpeRatio(activities) {
  if (!activities || activities.length < 2) {
    return null;
  }

  // Extract returns (profit/volume as percentage return per activity)
  const returns = activities
    .filter(a => Number(a.volume || 0) > 0)
    .map(a => {
      const profit = Number(a.profit || 0);
      const volume = Number(a.volume || 1);
      return profit / volume;
    });

  if (returns.length < 2) {
    return null;
  }

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero
  if (stdDev === 0) {
    return meanReturn > 0 ? 3 : meanReturn < 0 ? -1 : 0;
  }

  // Risk-free rate assumption (annualized ~5%, daily ~0.014%)
  const riskFreeRate = 0.00014;

  // Sharpe ratio
  const sharpeRatio = (meanReturn - riskFreeRate) / stdDev;

  return sharpeRatio;
}

// Determine tier based on Sharpe ratio
// A: Sharpe > 1.5 (Excellent risk-adjusted returns)
// B: Sharpe > 0.5 (Good)
// C: Sharpe > 0 (Fair)
// D: Sharpe <= 0 (Poor)
function getTierFromSharpe(sharpeRatio) {
  if (sharpeRatio === null) return null;
  if (sharpeRatio > 1.5) return 'A';
  if (sharpeRatio > 0.5) return 'B';
  if (sharpeRatio > 0) return 'C';
  return 'D';
}

// Generate random score within tier range (CIBIL-like 300-900)
// A: 750-900, B: 650-749, C: 550-649, D: 300-549
function generateScoreFromTier(tier) {
  const tierRanges = {
    'A': { min: 750, max: 900 },
    'B': { min: 650, max: 749 },
    'C': { min: 550, max: 649 },
    'D': { min: 300, max: 549 }
  };

  const range = tierRanges[tier] || tierRanges['D'];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// Generate random tier with weighted distribution
function generateRandomTier() {
  const rand = Math.random();
  // Distribution: A=15%, B=30%, C=35%, D=20%
  if (rand < 0.15) return 'A';
  if (rand < 0.45) return 'B';
  if (rand < 0.80) return 'C';
  return 'D';
}

function calculateScore(activities) {
  const volume = activities.reduce((a, x) => a + Number(x.volume || 0), 0);
  const pnl = activities.reduce((a, x) => a + Number(x.profit || 0), 0);
  const trades = activities.reduce((a, x) => a + Number(x.trades || 0), 0);

  // Try Sharpe ratio first
  const sharpeRatio = calculateSharpeRatio(activities);
  let tier = getTierFromSharpe(sharpeRatio);

  console.log(`[calculateScore] volume=${volume}, pnl=${pnl}, trades=${trades}, sharpe=${sharpeRatio?.toFixed(4) || 'N/A'}, tier=${tier || 'random'}`);

  // If Sharpe ratio couldn't be calculated (insufficient data), use random tier
  if (tier === null) {
    // Use activity-based heuristics with randomization
    if (activities.length > 0 && (volume > 0 || pnl !== 0)) {
      // Some activity exists, bias towards better tiers
      const rand = Math.random();
      if (pnl > 0) {
        // Profitable - lean towards A/B
        tier = rand < 0.3 ? 'A' : rand < 0.7 ? 'B' : 'C';
      } else if (pnl < 0) {
        // Loss - lean towards C/D
        tier = rand < 0.4 ? 'C' : rand < 0.8 ? 'D' : 'B';
      } else {
        // Neutral
        tier = generateRandomTier();
      }
    } else {
      // No meaningful activity - pure random
      tier = generateRandomTier();
    }
  }

  const score = generateScoreFromTier(tier);
  console.log(`[calculateScore] final tier=${tier}, score=${score}`);

  return score;
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
  if (leaves.length > 1 << depth) {
    throw new Error(`too many leaves for depth ${depth}`);
  }

  const levels = [];
  let current = leaves.slice();

  for (let d = 0; d < depth; d++) {
    levels.push(current);
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : zeroHashes[d];
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
    const sibling =
      level && siblingIndex < level.length
        ? level[siblingIndex]
        : zeroHashes[d];
    siblings.push(sibling);
    indices.push(idx & 1); // 0 if left, 1 if right
    idx = Math.floor(idx / 2);
  }
  return { siblings, indices };
}

function proxyToField(proxyAddress) {
  return BigInt(proxyAddress.toLowerCase());
}

app.post("/build-merkle-tree", async (req, res) => {
  try {
    const { agents } = req.body;
    if (!Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: "agents[] required" });
    }

    dailyProofIndexByAgent = new Map();
    dailyProofPayloadByAgent = new Map();
    const zeroHashes = buildZeroHashes(TREE_DEPTH);

    const leaves = [];
    for (let i = 0; i < agents.length; i++) {
      const { agentAddress, proxyAddress } = agents[i];
      const activities = await fetchPolymarket(proxyAddress);
      const stats = {
        totalVolume: Math.floor(
          activities.reduce((a, x) => a + Number(x.volume || 0), 0),
        ),
        totalPnl: Math.floor(
          activities.reduce((a, x) => a + Number(x.profit || 0), 0),
        ),
        tradeCount: Math.floor(
          activities.reduce(
            (a, x) => a + (Number(x.timestamp || 0) > 0 ? 1 : 0),
            0,
          ),
        ),
      };

      const score = calculateScore(activities);
      console.log(
        `Agent ${agentAddress} (proxy: ${proxyAddress}): activities.length=${activities.length}, volume=${stats.totalVolume}, pnl=${stats.totalPnl}, trades=${stats.tradeCount}, score=${score}`,
      );

      const proxyField = proxyToField(proxyAddress);
      const leaf = poseidonHash([
        proxyField,
        toField(stats.totalVolume),
        toField(stats.totalPnl),
        toField(stats.tradeCount),
      ]);
      leaves.push(leaf);
      dailyProofIndexByAgent.set(agentAddress.toLowerCase(), i);
      dailyProofPayloadByAgent.set(agentAddress.toLowerCase(), {
        stats,
        proxyField: proxyField.toString(),
      });
    }

    const built = buildFixedDepthTree(leaves, TREE_DEPTH, zeroHashes);
    dailyLevels = built.levels;
    dailyRoot = built.root;

    const chainId = (await provider.getNetwork()).chainId;
    const msgHash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "uint256"],
        [ZK_CREDIT_VERIFIER_ADDRESS, chainId, dailyRoot],
      ),
    );
    dailyRootSignature = await signer.signMessage(ethers.getBytes(msgHash));

    res.json({
      root: dailyRoot.toString(),
      rootSignature: dailyRootSignature,
      count: agents.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/merkle-proof/:agentAddress", async (req, res) => {
  try {
    const key = req.params.agentAddress.toLowerCase();
    if (
      !dailyRoot ||
      !dailyProofIndexByAgent.has(key) ||
      !dailyProofPayloadByAgent.has(key)
    ) {
      return res.status(404).json({ error: "agent not in current daily tree" });
    }

    const leafIndex = dailyProofIndexByAgent.get(key);
    const payload = dailyProofPayloadByAgent.get(key);
    const path = pathForIndex(
      dailyLevels,
      leafIndex,
      buildZeroHashes(TREE_DEPTH),
      TREE_DEPTH,
    );

    // Return proof material once and erase agent-specific ephemeral state.
    dailyProofIndexByAgent.delete(key);
    dailyProofPayloadByAgent.delete(key);

    res.json({
      root: dailyRoot.toString(),
      rootSignature: dailyRootSignature,
      pathElements: path.siblings.map((x) => x.toString()),
      pathIndices: path.indices,
      stats: payload.stats,
      proxyField: payload.proxyField,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/bitgo/status/:agentAddress", async (req, res) => {
  try {
    const status = await bitgo.getWalletStatus(req.params.agentAddress);
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get quote endpoint
app.post("/get-quote", async (req, res) => {
  try {
    const { agentAddress, collateralTokens, collateralAmounts } = req.body;

    if (!agentAddress || !collateralTokens || !collateralAmounts) {
      return res.status(400).json({
        error:
          "Missing required fields: agentAddress, collateralTokens, collateralAmounts",
      });
    }

    if (!Array.isArray(collateralTokens) || !Array.isArray(collateralAmounts)) {
      return res.status(400).json({
        error: "collateralTokens and collateralAmounts must be arrays",
      });
    }

    if (collateralTokens.length !== collateralAmounts.length) {
      return res.status(400).json({
        error: "collateralTokens and collateralAmounts must have same length",
      });
    }

    // Check if score is valid first
    const creditVerifier = new ethers.Contract(
      CREDIT_VERIFIER_ADDRESS,
      [
        "function isScoreValid(address) view returns (bool)",
        "function latestRecords(address) view returns (uint256,uint256,uint256)",
      ],
      provider,
    );

    const valid = await creditVerifier.isScoreValid(agentAddress);
    if (!valid) {
      return res.status(400).json({
        error: "Score expired or missing. Call /submit-score first.",
        agentAddress,
      });
    }

    // Get current score info
    const [score, leverage] = await creditVerifier.latestRecords(agentAddress);

    // Call on-chain getQuote with agent as sender
    const quote = await loanManager.getQuote(
      collateralTokens,
      collateralAmounts,
      {
        from: agentAddress,
      },
    );

    // Format response
    const tierNames = [
      "Very Poor",
      "Poor",
      "Fair",
      "Good",
      "Excellent",
      "Exceptional",
    ];

    const scoreStr = score.toString();
    const leverageStr = leverage.toString();
    const aprBpsStr = quote.aprBps.toString();
    const maxPrincipalStr = quote.maxPrincipal.toString();
    const tier = Number(quote.tier);

    res.json({
      agentAddress,
      score: scoreStr,
      tier,
      tierName: tierNames[tier] || "Unknown",
      aprBps: aprBpsStr,
      aprPercent: (Number(aprBpsStr) / 100).toFixed(2) + "%",
      maxPrincipal: maxPrincipalStr,
      maxPrincipalFormatted: ethers.formatUnits(maxPrincipalStr, 6) + " USDC",
      leverageBps: leverageStr,
      collateralTokens,
      collateralAmounts,
      scoreValid: true,
    });
  } catch (e) {
    console.error("Get quote error:", e);
    res.status(500).json({
      error: e.message,
      code: e.code,
    });
  }
});

// Calculate credit score without on-chain submission (for frontend display)
app.post("/calculate-score", async (req, res) => {
  try {
    const { agentAddress, proxyAddress } = req.body;
    console.log(`[calculate-score] agentAddress=${agentAddress}, proxyAddress=${proxyAddress}`);

    const activities = await fetchPolymarket(proxyAddress || agentAddress);
    console.log(`[calculate-score] fetched ${activities.length} activities`);

    const score = calculateScore(activities);
    console.log(`[calculate-score] calculated score=${score}`);

    // Determine tier
    let tier, tierName;
    if (score >= 750) {
      tier = "A";
      tierName = "Excellent";
    } else if (score >= 650) {
      tier = "B";
      tierName = "Good";
    } else if (score >= 550) {
      tier = "C";
      tierName = "Fair";
    } else {
      tier = "D";
      tierName = "Poor";
    }

    res.json({
      success: true,
      score,
      tier,
      tierName,
      activitiesCount: activities.length,
    });
  } catch (e) {
    console.error("[calculate-score] Error:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Fetch agents from 8004scan registry
app.get("/agents", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const response = await axios.get("https://www.8004scan.io/api/v1/public/agents", {
      params: {
        page,
        limit,
        chainId: 1,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      headers: {
        "accept": "application/json",
        "X-API-Key": process.env.API_KEY_8004 || "",
      },
      timeout: 15000,
    });

    if (response.data && response.data.success) {
      res.json(response.data);
    } else {
      res.json(response.data);
    }
  } catch (e) {
    console.error("[/agents] Error fetching from 8004scan:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/submit-score", async (req, res) => {
  try {
    const { agentAddress, proxyAddress, leverageBps = 10000 } = req.body;
    console.log(`[submit-score] agentAddress=${agentAddress}, proxyAddress=${proxyAddress}`);
    const activities = await fetchPolymarket(proxyAddress);
    console.log(`[submit-score] fetched ${activities.length} activities for proxy ${proxyAddress}`);
    const score = calculateScore(activities);
    console.log(`[submit-score] calculated score=${score} for agent=${agentAddress}`);
    const issuedAt = Math.floor(Date.now() / 1000);
    const proofHash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [agentAddress, proxyAddress, score, issuedAt],
      ),
    );

    const chainId = (await provider.getNetwork()).chainId;
    const message = ethers.keccak256(
      ethers.solidityPacked(
        [
          "address",
          "uint256",
          "address",
          "uint256",
          "uint256",
          "bytes32",
          "uint256",
        ],
        [
          CREDIT_VERIFIER_ADDRESS,
          chainId,
          agentAddress,
          score,
          leverageBps,
          proofHash,
          issuedAt,
        ],
      ),
    );
    const oracleSignature = await signer.signMessage(ethers.getBytes(message));

    const profile = await fileverse.storeAgentProfile(agentAddress, {
      score,
      proofHash,
      issuedAt,
    });
    const tx = await verifier.submitScore(
      agentAddress,
      score,
      leverageBps,
      proofHash,
      issuedAt,
      oracleSignature,
    );
    await tx.wait();

    res.json({
      score,
      leverageBps,
      proofHash,
      fileverseCid: profile.cid,
      txHash: tx.hash,
    });
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
