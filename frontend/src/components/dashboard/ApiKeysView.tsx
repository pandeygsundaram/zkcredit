/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Key, Clock, Sparkles, Code, Zap, Lock } from "lucide-react";
import Card from "../ui/Card";

const ApiKeysView: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">API Keys</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          Coming Soon
        </span>
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg text-center p-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                <Key className="h-10 w-10 text-zinc-500" />
              </div>
              <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black mb-3">API Access Coming Soon</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">
            We're building a powerful API that will allow developers to
            integrate zkCredit scores directly into their applications.
            Register your interest to be notified when it launches!
          </p>

          <div className="space-y-4 text-left bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6">
            <h3 className="font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              API Features
            </h3>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <Code className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                RESTful API with comprehensive documentation
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                Real-time credit score queries for any agent
              </li>
              <li className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                ZK proof generation for privacy-preserving verification
              </li>
              <li className="flex items-start gap-2">
                <Key className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                Webhook support for score change notifications
              </li>
            </ul>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-zinc-950 dark:bg-white">
            <code className="text-xs text-zinc-400 dark:text-zinc-600 font-mono">
              curl https://api.zkcredit.io/v1/score/0x...
            </code>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ApiKeysView;
