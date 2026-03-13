/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

const ApiKeysView: React.FC = () => {
  const [keys, setKeys] = useState([
    {
      id: "1",
      name: "Production_Key",
      key: "zk_live_••••••••••••••••4f2a",
      created: "2025-03-01",
    },
    {
      id: "2",
      name: "Testing_Staging",
      key: "zk_test_••••••••••••••••9a1b",
      created: "2025-03-10",
    },
  ]);

  const deleteKey = (id: string) => {
    setKeys(keys.filter((k) => k.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">API Keys</h1>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Create New Key
        </Button>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-900">
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Name
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  API Key
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Created
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-900/50"
                >
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold">{key.name}</p>
                  </td>
                  <td className="px-8 py-6">
                    <code className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                      {key.key}
                    </code>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm text-zinc-500">{key.created}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="rounded-full p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <h4 className="mb-4 font-bold">Security Tip</h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Never share your API keys or commit them to public repositories. Use
            environment variables to store your keys securely in your agent's
            runtime.
          </p>
        </Card>
        <Card>
          <h4 className="mb-4 font-bold">Usage Limits</h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your current plan allows for up to 5 active API keys and 100,000
            requests per month. Need more?{" "}
            <a
              href="#"
              className="font-bold text-zinc-950 underline dark:text-white"
            >
              Contact Sales
            </a>
            .
          </p>
        </Card>
      </div>
    </div>
  );
};

export default ApiKeysView;
