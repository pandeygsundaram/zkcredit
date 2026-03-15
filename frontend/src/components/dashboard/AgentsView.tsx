/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Search, Cpu, Star, Shield, Loader2, RefreshCw, AlertCircle } from "lucide-react";
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

interface AgentsViewProps {
  onSelectAgent: (agent: Agent) => void;
}

const AgentsView: React.FC<AgentsViewProps> = ({ onSelectAgent }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8787/agents");
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const result = await response.json();
      if (result.success && result.data) {
        setAgents(result.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (agent.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">AI Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">Loading registered agents...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="relative">
              <Cpu className="h-16 w-16 mx-auto text-zinc-200 dark:text-zinc-800" />
              <Loader2 className="h-8 w-8 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
            <p className="mt-6 text-sm text-zinc-500">Fetching agents from registry...</p>
            <p className="mt-1 text-xs text-zinc-400">This may take a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">AI Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">Failed to load agents</p>
        </div>
        <Card className="max-w-md mx-auto text-center p-8">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h3 className="font-bold text-lg mb-2">Connection Error</h3>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <p className="text-xs text-zinc-400 mb-6">
            Make sure the oracle server is running on port 8787
          </p>
          <Button onClick={fetchAgents} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">AI Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {agents.length} registered agents on the network
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAgents}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors"
            title="Refresh agents"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-full border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white w-64"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <Card
            key={agent.id}
            className="cursor-pointer transition-all hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700"
            onClick={() => onSelectAgent(agent)}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                {agent.image_url ? (
                  <img
                    src={agent.image_url}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : (
                  <Cpu className="h-6 w-6 text-zinc-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold truncate">{agent.name}</h3>
                  {agent.is_verified && (
                    <Shield className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {truncateAddress(agent.owner_address)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-zinc-500 line-clamp-2 min-h-[2.5rem]">
              {agent.description || "No description available"}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {agent.total_score > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    Score: {agent.total_score.toFixed(1)}
                  </span>
                )}
                {agent.health_score !== null && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    Health: {agent.health_score}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-zinc-400">
                <Star className="h-3 w-3" />
                <span className="text-xs">{agent.star_count}</span>
              </div>
            </div>

            {agent.supported_protocols.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {agent.supported_protocols.slice(0, 3).map((protocol) => (
                  <span
                    key={protocol}
                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {protocol}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <Cpu className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700" />
          <p className="mt-4 text-zinc-500">No agents found matching your search</p>
        </div>
      )}
    </div>
  );
};

export default AgentsView;
