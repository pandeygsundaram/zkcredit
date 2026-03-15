/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";

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

  // Navigate handler - skip login/signup, go directly to dashboard
  const handleNavigate = (targetView: string) => {
    if (targetView === "login" || targetView === "signup") {
      setView("dashboard");
    } else {
      setView(targetView);
    }
  };

  return (
    <div className="min-h-screen selection:bg-zinc-950 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950">
      {view === "landing" && (
        <>
          <Navbar onNavigate={handleNavigate} isDark={isDark} setIsDark={setIsDark} />
          <main>
            <Hero onNavigate={handleNavigate} />
            <BentoGrid />
            <Tiers />
            <ApiSection />
          </main>
          <Footer />
        </>
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
