const express = require('express');
const axios = require('axios');
const { ethers } = require('ethers');
const { FileverseClient } = require('./fileverse-client');
const { BitGoClient } = require('./bitgo-client');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8787;
const RPC_URL = process.env.RPC_URL;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const CREDIT_VERIFIER_ADDRESS = process.env.CREDIT_VERIFIER_ADDRESS;
const POLYMARKET_SUBGRAPH = process.env.POLYMARKET_SUBGRAPH || 'https://api.thegraph.com/subgraphs/name/polymarket/matic-markets';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
const verifier = new ethers.Contract(
  CREDIT_VERIFIER_ADDRESS,
  ['function submitScore(address,uint256,uint256,bytes32,uint256,bytes) external'],
  signer
);

const fileverse = new FileverseClient({ endpoint: process.env.FILEVERSE_ENDPOINT, apiKey: process.env.FILEVERSE_API_KEY });
const bitgo = new BitGoClient({ accessToken: process.env.BITGO_ACCESS_TOKEN, baseUrl: process.env.BITGO_BASE_URL });

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function norm(v, min, max, outMin, outMax) {
  if (v <= min) return outMin;
  if (v >= max) return outMax;
  return outMin + ((v - min) * (outMax - outMin)) / (max - min);
}

async function fetchPolymarket(proxyAddress) {
  const query = `query($user: String!) { userActivities(where:{user:$user}){ volume profit trades timestamp } }`;
  const out = await axios.post(POLYMARKET_SUBGRAPH, { query, variables: { user: proxyAddress.toLowerCase() } });
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

app.get('/bitgo/status/:agentAddress', async (req, res) => {
  try {
    const { agentAddress } = req.params;
    const status = await bitgo.getWalletStatus(agentAddress);
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
    const proofHash = ethers.keccak256(ethers.solidityPacked(['address','address','uint256','uint256'], [agentAddress, proxyAddress, score, issuedAt]));

    const chainId = (await provider.getNetwork()).chainId;
    const message = ethers.keccak256(
      ethers.solidityPacked(
        ['address','uint256','address','uint256','uint256','bytes32','uint256'],
        [CREDIT_VERIFIER_ADDRESS, chainId, agentAddress, score, leverageBps, proofHash, issuedAt]
      )
    );
    const oracleSignature = await signer.signMessage(ethers.getBytes(message));

    const profile = await fileverse.storeAgentProfile(agentAddress, { score, proxyAddress, proofHash, issuedAt });

    const tx = await verifier.submitScore(agentAddress, score, leverageBps, proofHash, issuedAt, oracleSignature);
    await tx.wait();

    res.json({ score, leverageBps, proofHash, fileverseCid: profile.cid, txHash: tx.hash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`oracle server listening on ${PORT}`));
