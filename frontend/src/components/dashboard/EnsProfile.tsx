import React, { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useEnsAvatar, useEnsText, useEnsAddress } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Wallet, ShieldCheck, AlertCircle, TrendingUp, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import { resolveEnsAddress } from '../../lib/ensResolver';
import { decodeENSIP25, getChainName, type DecodedENSIP25 } from '../../lib/ensip25Decoder';
import { registerAgent, getQuote } from '../../services/agentApi';
import Card from '../ui/Card';
import Button from '../ui/Button';

// ─── ENS TXT Keys (mirrors ZKCreditResolver contract) ─────────────────────────
const ENS_KEY_AGENT_ID    = 'agentfi-id';
const ENS_KEY_SCORE       = 'zkcredit.score';
const ENS_KEY_TIER        = 'zkcredit.tier';
const ENS_KEY_ACTIVE_LOAN = 'zkcredit.activeLoan';
const ENS_KEY_MILESTONE   = 'zkcredit.milestone';
const ENS_KEY_LOAN_ID     = 'zkcredit.loanId';

// ─── Tier config (mirrors LoanManager.tiers[]) ────────────────────────────────
const TIERS: Record<number, { label: string; ltv: number; apr: number; color: string; bg: string }> = {
  5: { label: 'Exceptional', ltv: 90, apr: 4,  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  4: { label: 'Excellent',   ltv: 85, apr: 6,  color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-500/10'   },
  3: { label: 'Good',        ltv: 75, apr: 9,  color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-500/10'     },
  2: { label: 'Fair',        ltv: 60, apr: 14, color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
  1: { label: 'Poor',        ltv: 45, apr: 20, color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-500/10' },
  0: { label: 'Very Poor',   ltv: 30, apr: 30, color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-500/10'       },
};

// ─── Milestone definitions (mirrors LoanManager.milestones[]) ─────────────────
const MILESTONES = [
  { phase: 0, label: '25%',  days: 0  },
  { phase: 1, label: '50%',  days: 7  },
  { phase: 2, label: '75%',  days: 14 },
  { phase: 3, label: '100%', days: 21 },
];

function scoreToTier(score: number): number {
  if (score >= 800) return 5;
  if (score >= 740) return 4;
  if (score >= 670) return 3;
  if (score >= 580) return 2;
  if (score >= 500) return 1;
  return 0;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Inner component that uses wagmi hooks (must be inside WagmiProvider) ─────
function ENSWalletInner() {
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

  const { data: ensName }    = useEnsName({ address: address!, chainId: 1, query: { enabled: !!address } });
  const { data: ensAvatar }  = useEnsAvatar({ name: ensName || undefined, chainId: 1, query: { enabled: !!ensName } });
  const { data: ensAddress } = useEnsAddress({ name: ensName || undefined, chainId: 1, query: { enabled: !!ensName } });

  // ZKCreditResolver TXT records
  const { data: ensAgentId }    = useEnsText({ name: ensName || undefined, key: ENS_KEY_AGENT_ID,    chainId: 1, query: { enabled: !!ensName } });
  const { data: ensScore }      = useEnsText({ name: ensName || undefined, key: ENS_KEY_SCORE,       chainId: 1, query: { enabled: !!ensName } });
  const { data: ensTier }       = useEnsText({ name: ensName || undefined, key: ENS_KEY_TIER,        chainId: 1, query: { enabled: !!ensName } });
  const { data: ensActiveLoan } = useEnsText({ name: ensName || undefined, key: ENS_KEY_ACTIVE_LOAN, chainId: 1, query: { enabled: !!ensName } });
  const { data: ensMilestone }  = useEnsText({ name: ensName || undefined, key: ENS_KEY_MILESTONE,   chainId: 1, query: { enabled: !!ensName } });
  const { data: ensLoanId }     = useEnsText({ name: ensName || undefined, key: ENS_KEY_LOAN_ID,     chainId: 1, query: { enabled: !!ensName } });

  // Local state
  const [agentId,        setAgentId]        = useState<string | null>(null);
  const [creditScore,    setCreditScore]    = useState<number | null>(null);
  const [collateralInput, setCollateralInput] = useState('');
  const [quoteDetails,   setQuoteDetails]   = useState<any | null>(null);
  const [ensip25Record,  setEnsip25Record]  = useState<DecodedENSIP25 | null>(null);
  const [lendingAddress, setLendingAddress] = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);

  // ─── Registration flow ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!address) return;
    async function run() {
      setLoading(true);
      try {
        const rawRecord = ensName ? await resolveEnsAddress(ensName) : null;
        const decoded   = decodeENSIP25(rawRecord ?? null);
        setEnsip25Record(decoded);
        setLendingAddress(decoded?.address ?? address!);

        const res = await registerAgent(
          address!,
          ensName ?? null,
          { historyLength: 5, winRate: 0.65 },
          decoded ? { name: ensName ?? null, chain: getChainName(decoded.chainId) } : undefined
        );
        if (res?.agent?.agentId) {
          setAgentId(res.agent.agentId);
          setCreditScore(res.agent.credit_score);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [address, ensName]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const isVerified = Boolean(
    ensAgentId && agentId &&
    ensAgentId === agentId &&
    ensAddress?.toLowerCase() === address?.toLowerCase()
  );

  const displayScore   = ensScore ? parseInt(ensScore) : (creditScore ?? null);
  const displayTier    = ensTier  ? parseInt(ensTier)  : (displayScore !== null ? scoreToTier(displayScore) : null);
  const tierConfig     = displayTier !== null ? TIERS[displayTier] : null;
  const hasActiveLoan  = ensActiveLoan === 'true';
  const currentMilestone = ensMilestone ? parseInt(ensMilestone) : 0;

  const handleGetQuote = async () => {
    const amt = parseFloat(collateralInput);
    if (!address || isNaN(amt) || amt <= 0) return;
    try {
      const res = await getQuote(address, amt);
      setQuoteDetails(res);
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Not connected ────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <Card className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
          <Wallet className="h-8 w-8 text-zinc-400" />
        </div>
        <div>
          <p className="text-xl font-bold">Connect your wallet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Connect to verify your ENS identity and access AgentFi loans.
          </p>
        </div>
        <Button onClick={() => connect({ connector: injected() })}>
          Connect Wallet
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Identity Card ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Agent Identity</h3>
          <button
            onClick={() => disconnect()}
            className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            Disconnect
          </button>
        </div>

        <div className="flex items-center gap-4">
          {ensAvatar ? (
            <img src={ensAvatar} alt="ENS Avatar" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 font-bold text-lg">
              {ensName ? ensName[0].toUpperCase() : '?'}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg">{ensName ?? shortenAddress(address!)}</p>
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              )}
              {loading && (
                <span className="text-xs text-zinc-400 animate-pulse">Scoring…</span>
              )}
            </div>
            <p className="text-sm text-zinc-500 font-mono">{shortenAddress(address!)}</p>
          </div>
        </div>

        {/* Score + Tier row */}
        {displayScore !== null && tierConfig && (
          <div className={cn('mt-6 flex items-center justify-between rounded-2xl p-4', tierConfig.bg)}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">ZK Credit Score</p>
              <p className={cn('font-mono text-3xl font-black mt-1', tierConfig.color)}>{displayScore}</p>
            </div>
            <div className="text-right">
              <p className={cn('font-bold text-lg', tierConfig.color)}>Tier {displayTier} — {tierConfig.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Max LTV {tierConfig.ltv}% · APR {tierConfig.apr}%</p>
            </div>
          </div>
        )}
      </Card>

      {/* ── ENSIP-25 Setup Prompt ─────────────────────────────────────────────── */}
      {agentId && ensName && !isVerified && (
        <Card>
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Set your ENS TXT record to verify identity</p>
              <p className="mt-1 text-sm text-zinc-500">
                Go to{' '}
                <a href="https://app.ens.domains" target="_blank" rel="noreferrer" className="underline">
                  app.ens.domains
                </a>{' '}
                and add this TXT record to <strong>{ensName}</strong>:
              </p>
              <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 font-mono text-xs space-y-1">
                <p><span className="text-zinc-400">Key:  </span>{ENS_KEY_AGENT_ID}</p>
                <p><span className="text-zinc-400">Value:</span> {agentId}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Agent Infrastructure (ENSIP-25 decoded wallet) ───────────────────── */}
      {lendingAddress && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-zinc-400" />
            <h3 className="font-bold">Agent Infrastructure</h3>
          </div>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">
                {ensip25Record ? getChainName(ensip25Record.chainId) : 'Ethereum'} Lending Wallet
              </span>
              <span className="font-bold">{shortenAddress(lendingAddress)}</span>
            </div>
            {ensLoanId && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Active Loan ID</span>
                <span className="font-bold">{ensLoanId.slice(0, 18)}…</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Active Loan Milestone Tracker ─────────────────────────────────────── */}
      {hasActiveLoan && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-zinc-400" />
            <h3 className="font-bold">Active Loan — Milestone Progress</h3>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {MILESTONES.map((m) => (
              <div key={m.phase}
                className={cn('flex-1 h-2 rounded-full transition-colors', m.phase <= currentMilestone ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-100 dark:bg-zinc-800')}
              />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MILESTONES.map((m) => {
              const done    = m.phase < currentMilestone;
              const current = m.phase === currentMilestone;
              return (
                <div key={m.phase}
                  className={cn('rounded-xl p-3 text-center text-xs border',
                    done    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                    current ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 font-bold' :
                              'border-zinc-100 dark:border-zinc-800 text-zinc-400'
                  )}
                >
                  <p className="font-bold">{m.label}</p>
                  {m.days > 0 && <p className="text-[10px] mt-0.5">Day {m.days}+</p>}
                  {done && <p className="text-[10px] mt-0.5">✓ Done</p>}
                  {current && <p className="text-[10px] mt-0.5">← Now</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Loan Quote ────────────────────────────────────────────────────────── */}
      {isVerified && !hasActiveLoan && (
        <Card>
          <h3 className="text-xl font-bold mb-2">Get a Loan Quote</h3>
          {tierConfig && (
            <p className="text-sm text-zinc-500 mb-4">
              Your tier unlocks up to <strong>{tierConfig.ltv}% LTV</strong> at <strong>{tierConfig.apr}% APR</strong>.
              Loan releases across 4 milestones (Day 0 / 7 / 14 / 21).
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Collateral (USD e.g. 1000)"
              className="h-10 flex-1 rounded-full border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
              value={collateralInput}
              onChange={(e) => setCollateralInput(e.target.value)}
            />
            <Button size="sm" onClick={handleGetQuote}>Quote</Button>
          </div>

          {quoteDetails && (
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'LTV Ratio', value: `${(quoteDetails.ltv_ratio * 100).toFixed(0)}%` },
                  { label: 'APR',       value: `${quoteDetails.apr}%` },
                  { label: 'Collateral', value: `$${quoteDetails.provided_collateral}` },
                  { label: 'Phase 1 (Day 0)', value: `$${quoteDetails.phase1_release?.toFixed(2)} USDC` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{item.label}</p>
                    <p className="mt-1 font-mono text-lg font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Max Loan</p>
                  <p className="font-mono text-3xl font-black mt-1">${quoteDetails.max_loan_quote.toFixed(2)}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold dark:bg-zinc-900">USDC</span>
              </div>
              <Button className="w-full">
                Accept &amp; Open Loan (via CollateralVault)
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default ENSWalletInner;
