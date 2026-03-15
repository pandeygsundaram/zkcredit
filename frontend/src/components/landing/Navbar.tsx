/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, ExternalLink, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";

interface NavbarProps {
  onNavigate: (view: string) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, isDark, setIsDark }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6",
        scrolled ? "py-4" : "py-6",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border px-6 transition-all duration-300",
          scrolled
            ? "border-zinc-200 bg-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/70 shadow-lg shadow-zinc-950/5"
            : "border-transparent bg-transparent",
        )}
      >
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate("landing")}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 dark:bg-white shadow-inner">
            <Shield className="h-5 w-5 text-white dark:text-zinc-950" />
          </div>
          <span className="font-mono text-xl font-black tracking-tighter">
            zkCredit
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-semibold text-zinc-500 md:flex dark:text-zinc-400">
          <a
            href="#features"
            className="hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            Protocol
          </a>
          <a
            href="#bento"
            className="hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            Privacy
          </a>
          <a
            href="#api"
            className="hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            API
          </a>
          <a
            href="https://docs.zkcredit.io"
            className="flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDark(!isDark)}
            className="rounded-full p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => onNavigate("dashboard")}
          >
            View Agents
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
