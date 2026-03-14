import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Shield, Wallet } from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import Card from "../ui/Card";

interface AuthPageProps {
  onNavigate: (view: string) => void;
}

const AuthPage = ({ onNavigate }: AuthPageProps) => {
  const { isConnected, address } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(null);

  const walletConnectors = useMemo(
    () =>
      connectors.filter(
        (connector, index, list) =>
          list.findIndex((candidate) => candidate.id === connector.id) === index,
      ),
    [connectors],
  );

  useEffect(() => {
    if (isConnected) {
      onNavigate("dashboard");
    }
  }, [isConnected, onNavigate]);

  async function handleConnectWallet(connectorId: string) {
    const connector = walletConnectors.find((item) => item.id === connectorId);

    if (!connector) {
      setErrorMessage("No browser wallet was detected. Please install MetaMask or another injected wallet.");
      return;
    }

    try {
      setErrorMessage(null);
      setPendingConnectorId(connector.id);
      await connectAsync({ connector });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection failed.";
      setErrorMessage(message);
    } finally {
      setPendingConnectorId(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 dark:bg-zinc-950">
      <Card className="w-full max-w-md border-zinc-200/80 bg-white/92 p-10 text-center shadow-2xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-black/30">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[1.6rem] bg-zinc-950 dark:bg-white">
          <Shield className="h-6 w-6 text-white dark:text-zinc-950" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
          zkCredit
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Login with wallet only.
        </p>

        <div className="mt-8 rounded-[2rem] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-zinc-950">
              <Wallet className="h-5 w-5 text-zinc-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">Owner wallet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect to search any agent ENS and view its credit profile.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {walletConnectors.length > 0 ? (
            walletConnectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnectWallet(connector.id)}
                disabled={isPending}
                className="flex w-full items-center justify-between rounded-full border border-zinc-200 bg-white px-5 py-4 text-left text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <Wallet className="h-4 w-4 text-zinc-500" />
                  </span>
                  <span>{connector.name}</span>
                </span>
                <span className="flex items-center gap-2 text-zinc-400">
                  {pendingConnectorId === connector.id ? "Connecting..." : "Connect"}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No wallet connector found in this browser.
            </div>
          )}
        </div>

        {address && (
          <p className="mt-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {address}
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">
            {errorMessage}
          </p>
        )}
      </Card>
    </div>
  );
};

export default AuthPage;
