/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "../../lib/utils";

const Card = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 hover:shadow-2xl hover:shadow-zinc-950/5 dark:hover:shadow-white/5",
      className,
    )}
    {...props}
  >
    <div className="relative z-10 h-full">{children}</div>
    <div className="absolute inset-0 z-0 bg-gradient-to-br from-transparent via-transparent to-zinc-50 opacity-0 transition-opacity group-hover:opacity-100 dark:to-zinc-900" />
  </div>
);

export default Card;
