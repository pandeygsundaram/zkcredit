/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Plus,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import Card from "../ui/Card";
import Button from "../ui/Button";

const LoansView: React.FC = () => {
  const loans = [
    {
      id: "LN-8492",
      agent: "TradingBot_Alpha",
      amount: "$1,200",
      collateral: "1.2 ETH",
      score: "A",
      status: "Active",
      progress: 65,
    },
    {
      id: "LN-3102",
      agent: "Sentiment_Agent_01",
      amount: "$500",
      collateral: "0.5 ETH",
      score: "B+",
      status: "Repaid",
      progress: 100,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">Loan Management</h1>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Loan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {loans.map((loan) => (
            <Card key={loan.id} className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="flex-1 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
                        <FileText className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{loan.id}</p>
                        <p className="text-xs text-zinc-400">
                          Agent: {loan.agent}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                        loan.status === "Active"
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Loan Amount
                      </p>
                      <p className="mt-1 font-mono text-2xl font-black">
                        {loan.amount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Collateral
                      </p>
                      <p className="mt-1 font-mono text-2xl font-black">
                        {loan.collateral}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-500">Repayment Progress</span>
                      <span>{loan.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-zinc-950 dark:bg-white"
                        style={{ width: `${loan.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-64 border-l border-zinc-100 bg-zinc-50/50 p-8 dark:border-zinc-900 dark:bg-zinc-900/20">
                  <h4 className="mb-6 text-xs font-black uppercase tracking-widest text-zinc-400">
                    Repayment Timeline
                  </h4>
                  <div className="space-y-6">
                    {[
                      {
                        label: "Milestone 1",
                        date: "Mar 10",
                        status: "completed",
                      },
                      {
                        label: "Milestone 2",
                        date: "Mar 25",
                        status: "current",
                      },
                      {
                        label: "Final Repay",
                        date: "Apr 10",
                        status: "pending",
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2",
                              step.status === "completed"
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : step.status === "current"
                                  ? "border-zinc-950 dark:border-white"
                                  : "border-zinc-200 dark:border-zinc-800",
                            )}
                          >
                            {step.status === "completed" && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {step.status === "current" && (
                              <Clock className="h-3 w-3" />
                            )}
                          </div>
                          {i < 2 && (
                            <div className="h-full w-0.5 bg-zinc-200 dark:bg-zinc-800" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{step.label}</p>
                          <p className="text-[10px] text-zinc-400">
                            {step.date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-6 text-xl font-bold">Agent Credit Profile</h3>
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-950 font-mono text-3xl font-black text-white dark:bg-white dark:text-zinc-950">
                A
              </div>
              <div>
                <p className="font-bold">TradingBot_Alpha</p>
                <p className="text-xs text-zinc-500">Verified since Jan 2025</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Total Borrowed", value: "$12,400" },
                { label: "On-time Repayments", value: "14" },
                { label: "Late Repayments", value: "0" },
                { label: "Polymarket Accuracy", value: "78%" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-900"
                >
                  <span className="text-xs text-zinc-500">{item.label}</span>
                  <span className="text-xs font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <h4 className="mb-2 font-bold">Need more liquidity?</h4>
            <p className="mb-6 text-sm text-zinc-400 dark:text-zinc-500">
              Increase your collateral or improve your agent's performance to
              unlock higher tiers.
            </p>
            <Button className="w-full bg-white text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900">
              Upgrade Tier
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoansView;
