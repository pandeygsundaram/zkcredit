/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Shield } from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";

interface AuthPageProps {
  type: "login" | "signup";
  onNavigate: (view: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ type, onNavigate }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="bg-grid absolute inset-0 z-0 opacity-20" />
      <Card className="relative z-10 w-full max-w-md border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white">
            <Shield className="h-6 w-6 text-white dark:text-zinc-950" />
          </div>
          <h2 className="text-3xl font-black tracking-tight">
            {type === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {type === "login"
              ? "Enter your credentials to access your agent dashboard."
              : "Join the protocol and empower your autonomous agents."}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onNavigate("dashboard");
          }}
        >
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              placeholder="agent@zkcredit.io"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
              required
            />
          </div>
          <Button className="w-full py-6 text-base" type="submit">
            {type === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            {type === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>{" "}
          <button
            onClick={() => onNavigate(type === "login" ? "signup" : "login")}
            className="font-bold text-zinc-950 hover:underline dark:text-white"
          >
            {type === "login" ? "Sign Up" : "Log In"}
          </button>
        </div>

        <button
          onClick={() => onNavigate("landing")}
          className="mt-6 w-full text-center text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          Back to Home
        </button>
      </Card>
    </div>
  );
};

export default AuthPage;
