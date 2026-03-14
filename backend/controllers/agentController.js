const agentRegistry = require('../services/agentRegistry');

// ─── POST /agents/register ───────────────────────────────────────────────────
const registerAgent = (req, res) => {
  const { wallet, ens_name, polymarket_metadata, ens_identity } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    const { agent, isFirstTime } = agentRegistry.register(
      wallet,
      ens_name,
      polymarket_metadata,
      ens_identity
    );

    return res.status(200).json({
      message: isFirstTime ? 'Agent Registered & Scored' : 'Agent Login Successful',
      isFirstTime,
      agent,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to register agent' });
  }
};

// ─── GET /agents/:wallet ─────────────────────────────────────────────────────
const getAgent = (req, res) => {
  const { wallet } = req.params;
  const agent = agentRegistry.get(wallet);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  return res.status(200).json(agent);
};

// ─── POST /agents/quote ───────────────────────────────────────────────────────
// Mirrors LoanManager.getQuote() — returns tier-based LTV/APR + full milestone schedule.
const getQuote = (req, res) => {
  const { wallet, collateral } = req.body;

  if (!wallet || !collateral) {
    return res.status(400).json({ error: 'wallet and collateral (USD) are required' });
  }

  const parsedCollateral = parseFloat(collateral);
  if (isNaN(parsedCollateral) || parsedCollateral < 500) {
    return res.status(400).json({ error: 'Minimum collateral is $500' });
  }

  const agent = agentRegistry.get(wallet);
  if (!agent) return res.status(404).json({ error: 'Agent not registered' });

  const scoreValidUntil = agent.score_valid_until ? new Date(agent.score_valid_until).getTime() : 0;
  if (!scoreValidUntil || scoreValidUntil <= Date.now()) {
    return res.status(403).json({ error: 'Credit score expired — please re-verify' });
  }

  const quoteResult = agentRegistry.quote(wallet, parsedCollateral);
  if (!quoteResult) return res.status(500).json({ error: 'Failed to generate quote' });

  return res.status(200).json(quoteResult);
};

module.exports = { registerAgent, getAgent, getQuote };
