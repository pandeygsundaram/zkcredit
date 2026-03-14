import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Clock3,
  Fingerprint,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAccount, useDisconnect, useEnsAddress, useEnsAvatar, useEnsText } from "wagmi";
import { cn } from "../../lib/utils";
import { getAgentByEnsName, getQuote, registerAgent } from "../../services/agentApi";
import Button from "../ui/Button";
import Card from "../ui/Card";

const ENS_KEY_AGENT_ID = "agentfi-id";
const ENS_KEY_SCORE = "zkcredit.score";
const ENS_KEY_TIER = "zkcredit.tier";
const ENS_KEY_ACTIVE_LOAN = "zkcredit.activeLoan";
const ENS_KEY_MILESTONE = "zkcredit.milestone";
const ENS_KEY_LOAN_ID = "zkcredit.loanId";

const TIERS: Record<number, { label: string; accent: string; surface: string }> = {
  5: { label: "Exceptional", accent: "text-emerald-600", surface: "bg-emerald-50 dark:bg-emerald-500/10" },
  4: { label: "Excellent", accent: "text-green-600", surface: "bg-green-50 dark:bg-green-500/10" },
  3: { label: "Good", accent: "text-sky-600", surface: "bg-sky-50 dark:bg-sky-500/10" },
  2: { label: "Fair", accent: "text-amber-600", surface: "bg-amber-50 dark:bg-amber-500/10" },
  1: { label: "Poor", accent: "text-orange-600", surface: "bg-orange-50 dark:bg-orange-500/10" },
  0: { label: "Very Poor", accent: "text-rose-600", surface: "bg-rose-50 dark:bg-rose-500/10" },
};

interface AgentRecord {
  agentId: string;
  wallet: string;
  ens_name: string | null;
  ens_identity?: {
    name: string | null;
    chain: string;
    address?: string;
  };
  credit_score: number;
  tier: number;
  tier_label: string;
  ltv_bps: number;
  apr_bps: number;
  max_loan_usd: number;
  score_valid_until?: string;
  ens_records: Record<string, string>;
  metadata: {
    createdAt: string;
    updatedAt?: string;
    fileStoreRef?: string;
  };
}

interface QuoteDetails {
  max_loan_quote: number;
  phase1_release: number;
  ltv_ratio: number;
  apr: number;
  provided_collateral: number;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLeft(value: string | null | undefined) {
  if (!value) return "No active deadline";

  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return "--";
  if (diff <= 0) return "Expired";

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${hours}h left`;
  return `${days}d ${hours}h left`;
}

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{label}</p>
      <p className="mt-3 font-mono text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

function EnsProfile() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const [searchInput, setSearchInput] = useState("");
  const [selectedEns, setSelectedEns] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails | null>(null);
  const [collateralInput, setCollateralInput] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const activeEnsName = selectedEns || searchInput.trim() || undefined;

  const { data: ensAvatar } = useEnsAvatar({ name: activeEnsName, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensAddress, refetch: refetchEnsAddress } = useEnsAddress({ name: activeEnsName, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensAgentId, refetch: refetchEnsAgentId } = useEnsText({ name: activeEnsName, key: ENS_KEY_AGENT_ID, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensScore, refetch: refetchEnsScore } = useEnsText({ name: activeEnsName, key: ENS_KEY_SCORE, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensTier, refetch: refetchEnsTier } = useEnsText({ name: activeEnsName, key: ENS_KEY_TIER, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensActiveLoan, refetch: refetchEnsActiveLoan } = useEnsText({ name: activeEnsName, key: ENS_KEY_ACTIVE_LOAN, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensMilestone, refetch: refetchEnsMilestone } = useEnsText({ name: activeEnsName, key: ENS_KEY_MILESTONE, chainId: 1, query: { enabled: !!activeEnsName } });
  const { data: ensLoanId, refetch: refetchEnsLoanId } = useEnsText({ name: activeEnsName, key: ENS_KEY_LOAN_ID, chainId: 1, query: { enabled: !!activeEnsName } });

  const displayScore = ensScore ? parseInt(ensScore, 10) : agent?.credit_score ?? null;
  const displayTier = ensTier ? parseInt(ensTier, 10) : agent?.tier ?? null;
  const tierView = displayTier !== null ? TIERS[displayTier] : null;
  const isOwner = Boolean(address && ensAddress && address.toLowerCase() === ensAddress.toLowerCase());
  const isVerified = Boolean(agent && ensAgentId && agent.agentId === ensAgentId && isOwner);
  const hasActiveLoan = (ensActiveLoan ?? agent?.ens_records?.[ENS_KEY_ACTIVE_LOAN] ?? "false") === "true";
  const returnedAmount = 0;
  const providedAmount = hasActiveLoan ? quoteDetails?.max_loan_quote ?? 0 : 0;
  const pendingAmount = Math.max(providedAmount - returnedAmount, 0);

  const records = useMemo(
    () => [
      { key: ENS_KEY_AGENT_ID, value: ensAgentId || agent?.ens_records?.[ENS_KEY_AGENT_ID] || "--" },
      { key: ENS_KEY_SCORE, value: ensScore || agent?.ens_records?.[ENS_KEY_SCORE] || "--" },
      { key: ENS_KEY_TIER, value: ensTier || agent?.ens_records?.[ENS_KEY_TIER] || "--" },
      { key: ENS_KEY_ACTIVE_LOAN, value: ensActiveLoan || agent?.ens_records?.[ENS_KEY_ACTIVE_LOAN] || "false" },
      { key: ENS_KEY_MILESTONE, value: ensMilestone || agent?.ens_records?.[ENS_KEY_MILESTONE] || "0" },
      { key: ENS_KEY_LOAN_ID, value: ensLoanId || agent?.ens_records?.[ENS_KEY_LOAN_ID] || "--" },
    ],
    [agent, ensActiveLoan, ensAgentId, ensLoanId, ensMilestone, ensScore, ensTier, refreshTick],
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchInput.trim()) return;

    setLoading(true);
    setLookupError(null);
    setQuoteDetails(null);
    setSelectedEns(searchInput.trim().toLowerCase());

    try {
      const fetchedAgent = await getAgentByEnsName(searchInput.trim().toLowerCase());
      setAgent(fetchedAgent);
    } catch {
      setAgent(null);
      setLookupError("No agent found for this ENS name yet.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!address || !activeEnsName) return;

    setLoading(true);
    setLookupError(null);
    try {
      const res = await registerAgent(
        address,
        activeEnsName,
        { historyLength: 5, winRate: 0.65 },
        { name: activeEnsName, chain: "ethereum" },
      );
      setAgent(res.agent);
    } catch {
      setLookupError("Unable to register this ENS profile right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuote() {
    if (!agent?.wallet) return;
    const collateral = parseFloat(collateralInput);
    if (Number.isNaN(collateral) || collateral < 500) return;

    try {
      const result = await getQuote(agent.wallet, collateral);
      setQuoteDetails(result);
    } catch {
      setLookupError("Unable to calculate quote right now.");
    }
  }

  async function handleRefresh() {
    await Promise.all([
      refetchEnsAddress(),
      refetchEnsAgentId(),
      refetchEnsScore(),
      refetchEnsTier(),
      refetchEnsActiveLoan(),
      refetchEnsMilestone(),
      refetchEnsLoanId(),
    ]);
    setRefreshTick((value) => value + 1);
  }

  return (
    <div className="space-y-8">
      <Card className="border-none bg-[linear-gradient(180deg,_#ffffff,_#f5f5f4)] p-8 shadow-xl shadow-zinc-900/5 dark:bg-[linear-gradient(180deg,_#0f0f10,_#151518)] dark:shadow-black/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400">Search Agent</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Enter any agent ENS and see the full profile.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Owner can add any agent ENS address here and view credit score, loan provided, kitna return kiya, kitna pending hai, aur kitna time bacha hai.
            </p>
          </div>
          <button
            onClick={() => disconnect()}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Logout
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search agent ENS, for example agent.eth"
              className="h-12 w-full rounded-full border border-zinc-200 bg-white pl-11 pr-5 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
            />
          </div>
          <Button type="submit" size="md">
            {loading ? "Loading..." : "Search"}
          </Button>
          {activeEnsName && isOwner && !agent && (
            <Button type="button" size="md" variant="outline" onClick={handleRegister}>
              Register ENS
            </Button>
          )}
        </form>
      </Card>

      {lookupError && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300">{lookupError}</p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                If this ENS belongs to you, register it once and then refresh the resolver records.
              </p>
            </div>
          </div>
        </Card>
      )}

      {agent && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Credit Score" value={displayScore ? String(displayScore) : "--"} hint="Current score attached to the agent profile." />
            <InfoCard label="Loan Provided" value={formatCurrency(providedAmount)} hint="Current visible loan amount." />
            <InfoCard label="Returned" value={formatCurrency(returnedAmount)} hint="Amount repaid so far." />
            <InfoCard label="Pending" value={formatCurrency(pendingAmount)} hint="Amount still pending." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
            <Card className="p-0">
              <div className="border-b border-zinc-200 bg-zinc-50 px-8 py-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    {ensAvatar ? (
                      <img src={ensAvatar} alt="ENS avatar" className="h-16 w-16 rounded-[1.4rem] object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-zinc-950 text-xl font-black text-white dark:bg-white dark:text-zinc-950">
                        {(activeEnsName || agent.ens_name || "?")[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black tracking-tight">{activeEnsName || agent.ens_name || "Unknown ENS"}</h2>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-sm text-zinc-500">{shortenAddress(agent.wallet)}</p>
                    </div>
                  </div>

                  <Button size="sm" variant="outline" onClick={handleRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 p-8 md:grid-cols-2">
                <div className={cn("rounded-[2rem] p-6", tierView?.surface || "bg-zinc-50 dark:bg-zinc-900")}>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Credit profile</p>
                  <p className={cn("mt-4 font-mono text-5xl font-black tracking-tight", tierView?.accent)}>{displayScore ?? "--"}</p>
                  <p className={cn("mt-2 text-lg font-black", tierView?.accent)}>
                    Tier {displayTier ?? agent.tier} · {tierView?.label || agent.tier_label}
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-zinc-500">
                    <p>Max loan: {formatCurrency(agent.max_loan_usd)}</p>
                    <p>APR: {agent.apr_bps / 100}%</p>
                    <p>LTV: {agent.ltv_bps / 100}%</p>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Fingerprint className="h-4 w-4" />
                    <p className="text-xs font-black uppercase tracking-[0.25em]">Agent details</p>
                  </div>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Agent ID</span>
                      <span className="font-mono font-bold">{agent.agentId}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Owner wallet</span>
                      <span className="font-mono font-bold">{shortenAddress(agent.wallet)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Loan ID</span>
                      <span className="font-mono font-bold">{ensLoanId || agent.ens_records[ENS_KEY_LOAN_ID] || "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Current milestone</span>
                      <span className="font-bold">{ensMilestone || agent.ens_records[ENS_KEY_MILESTONE] || "0"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Time left</span>
                      <span className="font-bold">{formatTimeLeft(agent.score_valid_until)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Score valid until</span>
                      <span className="font-bold">{formatDate(agent.score_valid_until)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-2 text-zinc-500">
                  <Wallet className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-[0.25em]">Loan snapshot</p>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">Loan active</span>
                    <span className="font-bold">{hasActiveLoan ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">Kitna return kiya</span>
                    <span className="font-bold">{formatCurrency(returnedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">Kitna pending hai</span>
                    <span className="font-bold">{formatCurrency(pendingAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">Kitna time bacha hai</span>
                    <span className="font-bold">{formatTimeLeft(agent.score_valid_until)}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Quote preview</p>
                <div className="mt-5 flex gap-2">
                  <input
                    type="number"
                    value={collateralInput}
                    onChange={(event) => setCollateralInput(event.target.value)}
                    placeholder="Collateral in USD"
                    className="h-11 flex-1 rounded-full border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-white"
                  />
                  <Button size="sm" onClick={handleQuote}>
                    Quote
                  </Button>
                </div>

                {quoteDetails && (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">Loan provided</span>
                      <span className="font-bold">{formatCurrency(quoteDetails.max_loan_quote)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">Phase 1 release</span>
                      <span className="font-bold">{formatCurrency(quoteDetails.phase1_release)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">APR</span>
                      <span className="font-bold">{quoteDetails.apr}%</span>
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex items-center gap-2 text-zinc-500">
                  <Clock3 className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-[0.25em]">Resolver records</p>
                </div>
                <div className="mt-5 space-y-3">
                  {records.map((record) => (
                    <div key={record.key} className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                      <span className="font-mono text-xs text-zinc-500">{record.key}</span>
                      <span className="max-w-[58%] truncate font-mono text-sm font-bold">{record.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EnsProfile;
