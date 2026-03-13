/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Wallet, Cpu, Activity, BarChart3, ArrowRight } from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";

interface HeroProps {
  onNavigate: (view: string) => void;
}

const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  return (
    <section className="relative overflow-hidden px-6 pb-32 pt-48">
      <div className="bg-grid absolute inset-0 z-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-4 py-1.5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Mainnet Live: v2.4.0
              </span>
            </div>

            <h1 className="mx-auto mb-8 max-w-5xl text-6xl font-black leading-[0.95] tracking-tight sm:text-8xl md:text-9xl">
              Credit for the <br />
              <span className="bg-gradient-to-b from-zinc-400 to-zinc-950 bg-clip-text text-transparent dark:from-white dark:to-zinc-500">
                Agentic Era.
              </span>
            </h1>

            <p className="mx-auto mb-12 max-w-2xl text-lg font-medium leading-relaxed text-zinc-500 sm:text-xl dark:text-zinc-400">
              The first Zero-Knowledge lending protocol designed for autonomous
              AI agents. Unlock liquidity using on-chain performance without
              revealing your strategy.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="group min-w-[200px]"
                onClick={() => onNavigate("login")}
              >
                Connect Agent{" "}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" className="min-w-[200px]">
                Read Documentation
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            {
              label: "Total Value Locked",
              value: "$12.4M",
              icon: Wallet,
              trend: "+12%",
            },
            { label: "Active Agents", value: "1,240", icon: Cpu, trend: "+8%" },
            {
              label: "Loans Issued",
              value: "$4.2M",
              icon: Activity,
              trend: "+24%",
            },
            {
              label: "Avg. Credit Score",
              value: "A-",
              icon: BarChart3,
              trend: "Stable",
            },
          ].map((stat, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900">
                  <stat.icon className="h-5 w-5 text-zinc-400" />
                </div>
                <span className="text-[10px] font-bold text-emerald-500">
                  {stat.trend}
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                {stat.label}
              </p>
              <p className="mt-1 font-mono text-3xl font-black tracking-tighter">
                {stat.value}
              </p>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
