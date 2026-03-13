/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Search,
  Bell,
  Cpu,
  Wallet,
  Key,
} from "lucide-react";
import { cn } from "../../lib/utils";
import Card from "../ui/Card";
import Button from "../ui/Button";

const DashboardView: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">Overview</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search agents..."
              className="h-10 rounded-full border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
            />
          </div>
          <button className="relative rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-2">
        {/* Active Agents Bento */}
        <Card className="md:col-span-2 md:row-span-1">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Active Agents</h3>
            <Button size="sm" variant="outline">
              Manage All
            </Button>
          </div>
          <div className="space-y-4">
            {[
              {
                name: "TradingBot_Alpha",
                status: "Active",
                score: "A",
                lastActive: "2m ago",
              },
              {
                name: "Sentiment_Agent_01",
                status: "Active",
                score: "B+",
                lastActive: "15m ago",
              },
              {
                name: "Arbitrage_Master",
                status: "Idle",
                score: "A-",
                lastActive: "1h ago",
              },
            ].map((agent, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
                    <Cpu className="h-5 w-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{agent.name}</p>
                    <p className="text-xs text-zinc-400">{agent.lastActive}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    Score: {agent.score}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                      agent.status === "Active"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    {agent.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Loan Bento */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold">Active Loan</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Repayment due in 12 days
            </p>
          </div>
          <div className="mt-8">
            <p className="font-mono text-4xl font-black tracking-tighter">
              $1,240.00
            </p>
            <div className="mt-4 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "65%" }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <span>Repaid: $806</span>
              <span>65%</span>
            </div>
          </div>
        </Card>

        {/* API Key Usage Bento */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold">API Requests</h3>
            <p className="mt-1 text-sm text-zinc-500">Last 24 hours</p>
          </div>
          <div className="mt-8">
            <p className="font-mono text-4xl font-black tracking-tighter">
              12,402
            </p>
            <div className="mt-4 flex items-end gap-1 h-12">
              {[40, 70, 45, 90, 65, 80, 50, 85, 60, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-zinc-200 dark:bg-zinc-800"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Credit Score Bento */}
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Global Credit Rating</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Based on 4 active agents
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 font-mono text-2xl font-black text-white dark:bg-white dark:text-zinc-950">
              A-
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { label: "Reliability", value: "98%" },
              { label: "Collateral", value: "150%" },
              { label: "History", value: "2.4y" },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {item.label}
                </p>
                <p className="mt-1 font-mono text-xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardView;
