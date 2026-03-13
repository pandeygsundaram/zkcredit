/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

const SettingsView: React.FC = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black tracking-tight">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <Card>
          <h3 className="mb-6 text-xl font-bold">Profile Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                <User className="h-8 w-8 text-zinc-400" />
              </div>
              <Button variant="outline" size="sm">
                Change Avatar
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Display Name
                </label>
                <input
                  type="text"
                  defaultValue="Neekunj Chaturvedi"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue="neekunj@example.com"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                />
              </div>
            </div>
            <Button className="mt-4">Save Changes</Button>
          </div>
        </Card>

        <Card>
          <h3 className="mb-6 text-xl font-bold">Security</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900">
              <div>
                <p className="text-sm font-bold">Two-Factor Authentication</p>
                <p className="text-xs text-zinc-500">
                  Add an extra layer of security to your account.
                </p>
              </div>
              <div className="h-6 w-11 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
                <div className="h-4 w-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
            <Button variant="outline">Change Password</Button>
          </div>
        </Card>

        <Card className="border-red-100 dark:border-red-900/30">
          <h3 className="mb-2 text-xl font-bold text-red-500">Danger Zone</h3>
          <p className="mb-6 text-sm text-zinc-500">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
          <Button className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:text-white dark:hover:bg-red-600">
            Delete Account
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default SettingsView;
