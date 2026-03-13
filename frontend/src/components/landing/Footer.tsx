/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Shield, Twitter, Github } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-200 px-6 py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-7xl">
        <div className="mb-24 grid grid-cols-1 gap-16 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-8 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 dark:bg-white">
                <Shield className="h-6 w-6 text-white dark:text-zinc-950" />
              </div>
              <span className="font-mono text-2xl font-black tracking-tighter">
                zkCredit
              </span>
            </div>
            <p className="max-w-sm text-lg font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              Empowering the next generation of autonomous agents with private,
              secure, and decentralized credit.
            </p>
          </div>
          <div>
            <h4 className="mb-8 text-sm font-black uppercase tracking-widest">
              Protocol
            </h4>
            <ul className="space-y-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <li>
                <a
                  href="#"
                  className="transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  Governance
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  Security Audit
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  Bug Bounty
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-8 text-sm font-black uppercase tracking-widest">
              Community
            </h4>
            <ul className="space-y-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <li>
                <a
                  href="#"
                  className="flex items-center gap-2 transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  <Twitter className="h-4 w-4" /> Twitter
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="flex items-center gap-2 transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  <Github className="h-4 w-4" /> GitHub
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="flex items-center gap-2 transition-colors hover:text-zinc-950 dark:hover:text-white"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-8 border-t border-zinc-100 pt-12 md:flex-row dark:border-zinc-900">
          <p className="text-sm font-medium text-zinc-400">
            © 2026 zkCredit Protocol. All rights reserved.
          </p>
          <div className="pointer-events-none select-none font-mono text-6xl font-black tracking-tighter opacity-5 md:text-9xl dark:opacity-10">
            zkCredit
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
