const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'agents.json');

function loadRegistry() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return new Map();
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) {
      return new Map();
    }

    const entries = JSON.parse(raw);
    return new Map(entries);
  } catch (error) {
    console.error('Failed to load agent registry:', error);
    return new Map();
  }
}

function saveRegistry() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...registry.entries()], null, 2));
  } catch (error) {
    console.error('Failed to persist agent registry:', error);
  }
}

// Persistent Map for storing agents between backend restarts
const registry = loadRegistry();

// ─── Tier config (mirrors LoanManager.tiers[]) ──────────────────────────────
// tier => { minScore, maxLTV (bps), interestAPR (bps), maxLoan (USD) }
const TIERS = {
  5: { label: 'Exceptional', minScore: 800, ltvBps: 9000, aprBps: 400,  maxLoan: 100000 },
  4: { label: 'Excellent',   minScore: 740, ltvBps: 8500, aprBps: 600,  maxLoan: 75000  },
  3: { label: 'Good',        minScore: 670, ltvBps: 7500, aprBps: 900,  maxLoan: 50000  },
  2: { label: 'Fair',        minScore: 580, ltvBps: 6000, aprBps: 1400, maxLoan: 25000  },
  1: { label: 'Poor',        minScore: 500, ltvBps: 4500, aprBps: 2000, maxLoan: 10000  },
  0: { label: 'Very Poor',   minScore: 300, ltvBps: 3000, aprBps: 3000, maxLoan: 5000   },
};

/**
 * Resolves a score to a tier (mirrors CreditVerifier._scoreToTier)
 */
function scoreToTier(score) {
  if (score >= 800) return 5;
  if (score >= 740) return 4;
  if (score >= 670) return 3;
  if (score >= 580) return 2;
  if (score >= 500) return 1;
  return 0;
}

/**
 * Calculates deterministic credit score from polymarket metadata.
 * Mirrors CreditVerifier._calculateScore() logic.
 *   - winRate (0.0-1.0)   → contributes 0-400 points
 *   - historyLength (days) → contributes 0-100 points (capped at 50 days)
 *   - drawdownBps          → up to -100 penalty
 *   - Base: 300
 */
function calculateScore(metadata) {
  const { winRate = 0, historyLength = 0, maxDrawdownBps = 0 } = metadata;

  const baseScore      = 300;
  const volumeScore    = Math.min(winRate * 400, 400);                        // 0-400
  const experienceScore = Math.min((historyLength / 50) * 100, 100);          // 0-100
  const drawdownPenalty = maxDrawdownBps > 5000 ? 100 : (maxDrawdownBps * 100 / 5000); // 0-100

  const raw = baseScore + volumeScore + experienceScore - drawdownPenalty;
  return Math.max(300, Math.min(850, Math.round(raw)));
}

const register = (wallet, ens_name, polymarket_metadata = null, ens_identity = null) => {
  const address = wallet.toLowerCase();

  const isFirstTime = !registry.has(address);
  const existingAgent = registry.get(address) || {};

  // Assign sequential agentId if new
  const agentId = existingAgent.agentId || (registry.size + 1).toString();

  // Compute credit score using contract-aligned formula
  const scoreExpired = existingAgent.score_valid_until
    ? new Date(existingAgent.score_valid_until).getTime() <= Date.now()
    : true;

  let creditScore = existingAgent.credit_score || 0;
  if ((isFirstTime || scoreExpired) && polymarket_metadata) {
    creditScore = calculateScore(polymarket_metadata);
  }

  const tier = scoreToTier(creditScore);
  const tierConfig = TIERS[tier];

  const agent = {
    agentId,
    wallet: address,
    ens_name: ens_name || existingAgent.ens_name || null,
    ens_identity: ens_identity || existingAgent.ens_identity || {
      name: ens_name || null,
      chain: 'ethereum',
    },
    // ZK Credit state (mirrors CreditVerifier storage)
    credit_score: creditScore,
    tier,
    tier_label: tierConfig.label,
    ltv_bps: tierConfig.ltvBps,
    apr_bps: tierConfig.aprBps,
    max_loan_usd: tierConfig.maxLoan,
    score_valid_until: polymarket_metadata || scoreExpired || isFirstTime
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : existingAgent.score_valid_until,
    // Loan state (mirrors ZKCreditResolver ENS records once on-chain)
    ens_records: {
      'agentfi-id':          agentId,
      'zkcredit.score':      String(creditScore),
      'zkcredit.tier':       String(tier),
      'zkcredit.activeLoan': existingAgent.ens_records?.['zkcredit.activeLoan'] || 'false',
      'zkcredit.milestone':  existingAgent.ens_records?.['zkcredit.milestone'] || '0',
      'zkcredit.loanId':     existingAgent.ens_records?.['zkcredit.loanId'] || '',
    },
    metadata: {
      createdAt: existingAgent.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileStoreRef: `ipfs://agentfi/agent/${agentId}`,
    },
  };

  registry.set(address, agent);
  saveRegistry();
  return { agent, isFirstTime };
};

/**
 * Calculates a loan quote using exact contract tier parameters.
 * Mirrors LoanManager.getQuote() — uses LTV bps and ensures maxLoan cap.
 */
const quote = (wallet, collateralUsd) => {
  const agent = registry.get(wallet.toLowerCase());
  if (!agent) return null;

  const tier = TIERS[agent.tier];
  const ltvDecimal = tier.ltvBps / 10000;       // e.g. 9000 bps → 0.90
  const aprDecimal = tier.aprBps / 10000;       // e.g. 400 bps → 0.04

  const rawMaxLoan = collateralUsd * ltvDecimal;
  const maxLoan = Math.min(rawMaxLoan, tier.maxLoan);

  // Milestone breakdown (mirrors LoanManager.milestones[])
  const milestones = [
    { phase: 1, collateralPercent: 25, loanPercent: 25, unlockDays: 0  },
    { phase: 2, collateralPercent: 50, loanPercent: 50, unlockDays: 7  },
    { phase: 3, collateralPercent: 75, loanPercent: 75, unlockDays: 14 },
    { phase: 4, collateralPercent: 100, loanPercent: 100, unlockDays: 21 },
  ];

  return {
    agentId:            agent.agentId,
    credit_score:       agent.credit_score,
    tier:               agent.tier,
    tier_label:         agent.tier_label,
    provided_collateral: collateralUsd,
    ltv_ratio:          ltvDecimal,
    apr:                aprDecimal * 100,        // as percentage
    max_loan_quote:     maxLoan,
    phase1_release:     maxLoan * 0.25,          // 25% released on open
    stablecoin_offered: 'USDC',
    milestones:         milestones.map(m => ({
      ...m,
      collateralRequired: collateralUsd * m.collateralPercent / 100,
      loanReleased:       maxLoan * m.loanPercent / 100,
    })),
    liquidation_threshold: '105%',
    keeper_reward:         '5%',
    protocol_fee:          '1%',
  };
};

const get = (wallet) => registry.get(wallet.toLowerCase()) || null;

module.exports = { register, quote, get };
