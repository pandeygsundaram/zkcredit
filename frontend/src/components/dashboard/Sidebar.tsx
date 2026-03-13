/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Shield,
  Moon,
  Sun,
  LayoutDashboard,
  FileText,
  Key,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  isDark,
  setIsDark,
}) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "loans", label: "Loans", icon: FileText },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-64 border-r border-zinc-200 bg-white px-4 py-8 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-12 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 dark:bg-white">
          <Shield className="h-5 w-5 text-white dark:text-zinc-950" />
        </div>
        <span className="font-mono text-xl font-black tracking-tighter">
          zkCredit
        </span>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
              activeTab === item.id
                ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-white"
                : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/50",
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="absolute bottom-8 left-4 right-4 flex items-center justify-between">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>

        <button
          onClick={() => setIsDark(!isDark)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-950 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
