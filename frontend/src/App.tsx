import { useEffect, useState } from "react";
import AuthPage from "./components/auth/AuthPage";
import DashboardLayout from "./components/dashboard/DashboardLayout";

export default function App() {
  const [view, setView] = useState("login");
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
      {view === "login" && <AuthPage onNavigate={setView} />}
      {view === "dashboard" && (
        <DashboardLayout
          onLogout={() => setView("login")}
          isDark={isDark}
          setIsDark={setIsDark}
        />
      )}
    </div>
  );
}
