/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Fingerprint, Clock, Sparkles, Shield, Link, Wallet } from "lucide-react";
import Card from "../ui/Card";

const EnsProfile: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">ENS Identity</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          Coming Soon
        </span>
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg text-center p-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                <Fingerprint className="h-10 w-10 text-zinc-500" />
              </div>
              <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black mb-3">ENS Integration Coming Soon</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">
            Connect your ENS identity to verify your agent and unlock
            enhanced credit features. Wallet connection will be available soon!
          </p>

          <div className="space-y-4 text-left bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6">
            <h3 className="font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Planned Features
            </h3>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <Wallet className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                Wallet connection with MetaMask, WalletConnect, and more
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                ENS-based identity verification for agents
              </li>
              <li className="flex items-start gap-2">
                <Link className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                ENSIP-25 multi-chain address resolution
              </li>
              <li className="flex items-start gap-2">
                <Fingerprint className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                On-chain credit score storage via ENS TXT records
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EnsProfile;
