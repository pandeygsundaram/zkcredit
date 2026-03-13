/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";

// Auth components
import AuthPage from "./components/auth/AuthPage";

// Landing page components
import Navbar from "./components/landing/Navbar";
import Hero from "./components/landing/Hero";
import BentoGrid from "./components/landing/BentoGrid";
import Tiers from "./components/landing/Tiers";
import ApiSection from "./components/landing/ApiSection";
import Footer from "./components/landing/Footer";

// Dashboard components
import DashboardLayout from "./components/dashboard/DashboardLayout";

export default function App() {
  const [view, setView] = useState("landing");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen selection:bg-zinc-950 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950">
      {view === "landing" && (
        <>
          <Navbar onNavigate={setView} isDark={isDark} setIsDark={setIsDark} />
          <main>
            <Hero onNavigate={setView} />
            <BentoGrid />
            <Tiers />
            <ApiSection />
          </main>
          <Footer />
        </>
      )}
      {(view === "login" || view === "signup") && (
        <AuthPage type={view as "login" | "signup"} onNavigate={setView} />
      )}
      {view === "dashboard" && (
        <DashboardLayout
          onLogout={() => setView("landing")}
          isDark={isDark}
          setIsDark={setIsDark}
        />
      )}
    </div>
  );
}
