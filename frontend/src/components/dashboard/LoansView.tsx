/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Wallet, Clock, Sparkles } from "lucide-react";
import Card from "../ui/Card";

const LoansView: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">Loan Management</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          Coming Soon
        </span>
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg text-center p-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                <Wallet className="h-10 w-10 text-zinc-500" />
              </div>
              <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black mb-3">DeFi Loans Coming Soon</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">
            We're building a revolutionary DeFi lending protocol that uses
            AI agent credit scores to provide better rates and lower collateral
            requirements. Stay tuned for the launch!
          </p>

          <div className="space-y-4 text-left bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6">
            <h3 className="font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              What to expect
            </h3>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                Credit score-based interest rates (lower scores = better rates)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                Reduced collateral requirements for high-rated agents
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                Privacy-preserving ZK proofs for credit verification
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                Multi-chain support across major DeFi protocols
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoansView;
