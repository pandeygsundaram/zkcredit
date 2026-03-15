/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Shield,
  Star,
  Loader2,
  Activity,
  Wallet,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

interface Agent {
  id: string;
  agent_id: string;
  token_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  owner_address: string;
  total_score: number;
  health_score: number | null;
  star_count: number;
  supported_protocols: string[];
  is_verified: boolean;
  created_at: string;
}

interface CreditScore {
  score: number;
  tier: string;
  tierName: string;
  description: string;
  tradingAnalysis: string;
}

interface AgentDetailViewProps {
  agent: Agent;
  onBack: () => void;
}

const ORACLE_BASE_URL = "http://localhost:8787";

const AgentDetailView: React.FC<AgentDetailViewProps> = ({ agent, onBack }) => {
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreditScore();
  }, [agent.owner_address]);

  const fetchCreditScore = async () => {
    setLoading(true);
    setError(null);
    setCreditScore(null);

    try {
      const response = await fetch(`${ORACLE_BASE_URL}/calculate-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: agent.owner_address,
          proxyAddress: agent.owner_address,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to calculate credit score");
      }

      const score = data.score;

      // Determine description based on tier
      let description: string;
      let tradingAnalysis: string;

      if (data.tier === "A") {
        description =
          "This agent demonstrates exceptional trading performance with consistent risk-adjusted returns. Highly reliable for DeFi interactions.";
        tradingAnalysis =
          "Strong positive Sharpe ratio indicating excellent risk management. Consistent profit generation with minimal drawdowns.";
      } else if (data.tier === "B") {
        description =
          "This agent shows solid trading performance with good risk management. Suitable for most DeFi lending protocols.";
        tradingAnalysis =
          "Above-average risk-adjusted returns. Good balance between profit-seeking and risk mitigation strategies.";
      } else if (data.tier === "C") {
        description =
          "This agent has moderate trading performance. May require additional collateral for certain lending protocols.";
        tradingAnalysis =
          "Mixed trading results with some profitable periods. Risk management could be improved for better consistency.";
      } else {
        description =
          "This agent shows limited trading history or suboptimal performance. Higher collateral requirements expected.";
        tradingAnalysis =
          "Limited trading data or negative returns observed. Consider improving trading strategy before seeking larger loans.";
      }

      setCreditScore({
        score,
        tier: data.tier,
        tierName: data.tierName,
        description,
        tradingAnalysis,
      });
    } catch (err) {
      console.error("Credit score fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to calculate credit score"
      );
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "A":
        return "bg-emerald-500 text-white";
      case "B":
        return "bg-blue-500 text-white";
      case "C":
        return "bg-yellow-500 text-white";
      case "D":
        return "bg-red-500 text-white";
      default:
        return "bg-zinc-500 text-white";
    }
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 750) return "bg-emerald-500";
    if (score >= 650) return "bg-blue-500";
    if (score >= 550) return "bg-yellow-500";
    return "bg-red-500";
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{agent.name}</h1>
          <p className="text-sm text-zinc-500 font-mono">
            {truncateAddress(agent.owner_address)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Credit Score Card */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Credit Score Analysis</h2>
            <button
              onClick={fetchCreditScore}
              disabled={loading}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
            >
              {loading ? "Calculating..." : "Recalculate"}
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-zinc-400" />
                <p className="mt-4 text-sm text-zinc-500">
                  Calculating credit score using Sharpe ratio analysis...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="py-16 text-center">
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchCreditScore}
                className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {creditScore && !loading && (
            <div className="space-y-8">
              {/* Score Display */}
              <div className="flex items-center gap-8">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-3xl ${getTierColor(creditScore.tier)} shadow-lg`}
                >
                  <span className="font-mono text-4xl font-black">
                    {creditScore.tier}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-5xl font-black tracking-tighter">
                      {creditScore.score}
                    </span>
                    <span className="text-lg text-zinc-500">/ 900</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {creditScore.tierName} Credit Rating
                  </p>
                </div>
              </div>

              {/* Score Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-zinc-500">
                  <span>300</span>
                  <span>550</span>
                  <span>650</span>
                  <span>750</span>
                  <span>900</span>
                </div>
                <div className="h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getScoreBarColor(creditScore.score)} transition-all duration-500`}
                    style={{
                      width: `${((creditScore.score - 300) / 600) * 100}%`,
                    }}
                  />
                  {/* Tier markers */}
                  <div className="absolute top-0 left-[41.67%] w-px h-full bg-zinc-300 dark:bg-zinc-600" />
                  <div className="absolute top-0 left-[58.33%] w-px h-full bg-zinc-300 dark:bg-zinc-600" />
                  <div className="absolute top-0 left-[75%] w-px h-full bg-zinc-300 dark:bg-zinc-600" />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  <span>Poor</span>
                  <span>Fair</span>
                  <span>Good</span>
                  <span>Excellent</span>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-900">
                <h3 className="font-bold mb-2">Assessment</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {creditScore.description}
                </p>
              </div>

              {/* Trading Analysis */}
              <div className="rounded-2xl border border-zinc-100 p-6 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-5 w-5 text-zinc-500" />
                  <h3 className="font-bold">Trading Performance</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {creditScore.tradingAnalysis}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Agent Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                {agent.image_url ? (
                  <img
                    src={agent.image_url}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Shield className="h-8 w-8 text-zinc-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{agent.name}</h3>
                  {agent.is_verified && (
                    <Shield className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <p className="text-xs text-zinc-500">Token #{agent.token_id}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900">
                <span className="text-xs text-zinc-500">Owner</span>
                <span className="text-xs font-mono font-medium">
                  {truncateAddress(agent.owner_address)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900">
                <span className="text-xs text-zinc-500">Platform Score</span>
                <span className="text-xs font-bold">
                  {agent.total_score > 0 ? agent.total_score.toFixed(1) : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900">
                <span className="text-xs text-zinc-500">Health Score</span>
                <span className="text-xs font-bold">
                  {agent.health_score ?? "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900">
                <span className="text-xs text-zinc-500">Stars</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs font-bold">{agent.star_count}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Registered</span>
                <span className="text-xs font-medium">
                  {formatDate(agent.created_at)}
                </span>
              </div>
            </div>
          </Card>

          {agent.supported_protocols.length > 0 && (
            <Card>
              <h4 className="font-bold mb-4">Supported Protocols</h4>
              <div className="flex flex-wrap gap-2">
                {agent.supported_protocols.map((protocol) => (
                  <span
                    key={protocol}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800"
                  >
                    {protocol}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {agent.description && (
            <Card>
              <h4 className="font-bold mb-4">Description</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {agent.description}
              </p>
            </Card>
          )}

          <Card className="bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5" />
              <h4 className="font-bold">Request Loan</h4>
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">
              Coming soon! Use this agent's credit score to access DeFi lending
              protocols with better rates.
            </p>
            <Button
              disabled
              className="w-full bg-white text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900 opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentDetailView;
