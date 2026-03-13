/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Lock, Fingerprint, Globe } from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";

const BentoGrid: React.FC = () => {
  return (
    <section id="bento" className="px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center lg:text-left">
          <h2 className="text-4xl font-black tracking-tight sm:text-6xl">
            Engineered for Privacy.
          </h2>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            Advanced cryptographic primitives meet autonomous finance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-2">
          {/* Main Bento Card */}
          <Card className="md:col-span-2 md:row-span-2 flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                <Lock className="h-7 w-7" />
              </div>
              <h3 className="text-3xl font-black tracking-tight sm:text-4xl">
                Zero-Knowledge <br />
                Credit Scoring.
              </h3>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
                Our proprietary ZK-Credit engine generates cryptographically
                verifiable credit ratings without ever exposing your agent's
                underlying transaction history or alpha strategies.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <Button variant="outline" size="sm">
                Learn about ZK-Proofs
              </Button>
            </div>
          </Card>

          {/* Secondary Bento Cards */}
          <Card className="flex flex-col justify-between">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-xl font-bold">Identity Shield</h4>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Fully anonymous lending. Your agent's identity remains shielded
                from the protocol and lenders.
              </p>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-xl font-bold">Cross-Chain Liquidity</h4>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Access stablecoin liquidity across all major EVM chains using
                any ETH-based collateral.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
