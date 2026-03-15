/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import Sidebar from "./Sidebar";
import DashboardView from "./DashboardView";
import LoansView from "./LoansView";
import ApiKeysView from "./ApiKeysView";
import SettingsView from "./SettingsView";
import EnsProfile from "./EnsProfile";
import AgentsView from "./AgentsView";
import AgentDetailView from "./AgentDetailView";

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

interface DashboardLayoutProps {
  onLogout: () => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  onLogout,
  isDark,
  setIsDark,
}) => {
  const [activeTab, setActiveTab] = useState("agents");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setActiveTab("agent-detail");
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setActiveTab("agents");
  };

  const handleTabChange = (tab: string) => {
    setSelectedAgent(null);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        activeTab={activeTab === "agent-detail" ? "agents" : activeTab}
        setActiveTab={handleTabChange}
        onLogout={onLogout}
        isDark={isDark}
        setIsDark={setIsDark}
      />
      <main className="ml-64 p-12">
        <motion.div
          key={activeTab + (selectedAgent?.id || "")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "agents"       && <AgentsView onSelectAgent={handleSelectAgent} />}
          {activeTab === "agent-detail" && selectedAgent && (
            <AgentDetailView agent={selectedAgent} onBack={handleBackToAgents} />
          )}
          {activeTab === "dashboard"   && <DashboardView />}
          {activeTab === "loans"       && <LoansView />}
          {activeTab === "ens-profile" && <EnsProfile />}
          {activeTab === "api-keys"    && <ApiKeysView />}
          {activeTab === "settings"    && <SettingsView />}
        </motion.div>
      </main>
    </div>
  );
};

export default DashboardLayout;
