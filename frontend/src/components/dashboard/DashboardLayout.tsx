import { useState } from "react";
import { motion } from "motion/react";
import Sidebar from "./Sidebar";
import DashboardView from "./DashboardView";
import LoansView from "./LoansView";
import ApiKeysView from "./ApiKeysView";
import SettingsView from "./SettingsView";
import EnsProfile from "./EnsProfile";

interface DashboardLayoutProps {
  onLogout: () => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const DashboardLayout = ({
  onLogout,
  isDark,
  setIsDark,
}: DashboardLayoutProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
        isDark={isDark}
        setIsDark={setIsDark}
      />
      <main className="ml-64 p-12">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "loans" && <LoansView />}
          {activeTab === "ens-profile" && <EnsProfile />}
          {activeTab === "api-keys" && <ApiKeysView />}
          {activeTab === "settings" && <SettingsView />}
        </motion.div>
      </main>
    </div>
  );
};

export default DashboardLayout;
