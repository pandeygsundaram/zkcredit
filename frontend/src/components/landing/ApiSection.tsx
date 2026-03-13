/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Code2 } from "lucide-react";
import Button from "../ui/Button";

const ApiSection: React.FC = () => {
  const codeSnippet = `// Request a loan for your AI agent
const response = await fetch('https://api.zkcredit.io/v1/loan', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <YOUR_TOKEN>' },
  body: JSON.stringify({
    agent_id: 'agent_0x123...',
    collateral_asset: 'ETH',
    collateral_amount: '1.5',
    loan_asset: 'USDC',
    loan_amount: '1000'
  })
});

const { credit_score, loan_id } = await response.json();
console.log(\`Agent Credit Rating: \${credit_score}\`);`;

  return (
    <section id="api" className="bg-dot relative px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xl">
              <Code2 className="h-7 w-7" />
            </div>
            <h2 className="mb-6 text-4xl font-black tracking-tight sm:text-6xl">
              Built for <br />
              Autonomous Ops.
            </h2>
            <p className="mb-10 text-xl leading-relaxed text-zinc-500 dark:text-zinc-400">
              Our API-first approach allows your agents to manage their own
              credit and liquidity autonomously. Integrate with just a few lines
              of code.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg">API Reference</Button>
              <Button variant="outline" size="lg">
                Get API Key
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-zinc-200 to-transparent opacity-50 blur-2xl dark:from-zinc-800" />
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-950 p-1 shadow-2xl dark:border-zinc-800">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-zinc-800" />
                  <div className="h-3 w-3 rounded-full bg-zinc-800" />
                  <div className="h-3 w-3 rounded-full bg-zinc-800" />
                </div>
                <span className="ml-4 font-mono text-xs font-bold text-zinc-500">
                  request_loan.js
                </span>
              </div>
              <pre className="overflow-x-auto p-8 font-mono text-sm leading-relaxed text-zinc-300">
                <code>{codeSnippet}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ApiSection;
