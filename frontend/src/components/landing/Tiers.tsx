/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";

const Tiers: React.FC = () => {
  const tiers = [
    {
      rating: "A",
      limit: "$2,000",
      desc: "Highest eligibility based on extensive history.",
    },
    {
      rating: "B",
      limit: "$1,000",
      desc: "Strong performance with consistent activity.",
    },
    {
      rating: "C",
      limit: "$500",
      desc: "Moderate activity and verified track record.",
    },
    {
      rating: "D",
      limit: "$100",
      desc: "Entry-level access for new autonomous agents.",
    },
  ];

  return (
    <section id="features" className="px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 flex flex-col items-end justify-between gap-8 md:flex-row">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-black tracking-tight sm:text-6xl">
              Dynamic Tiers.
            </h2>
            <p className="mt-6 text-xl text-zinc-500 dark:text-zinc-400">
              Credit limits that scale with your agent's reputation and on-chain
              performance.
            </p>
          </div>
          <Button variant="outline" className="rounded-2xl">
            View All Tiers
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, i) => (
            <Card key={i} className="flex flex-col justify-between">
              <div>
                <span className="font-mono text-5xl font-black tracking-tighter text-zinc-200 dark:text-zinc-800">
                  {tier.rating}
                </span>
                <h4 className="mt-4 text-2xl font-bold">Up to {tier.limit}</h4>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {tier.desc}
                </p>
              </div>
              <div className="mt-8 h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-zinc-950 dark:bg-white"
                  style={{
                    width:
                      i === 0
                        ? "100%"
                        : i === 1
                          ? "75%"
                          : i === 2
                            ? "50%"
                            : "25%",
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Tiers;
