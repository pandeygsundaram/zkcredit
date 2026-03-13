/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "../../lib/utils";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  const variants = {
    primary:
      "bg-zinc-950 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-lg shadow-zinc-950/10 dark:shadow-white/10",
    outline:
      "border border-zinc-200 bg-transparent hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900",
    ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-900",
  };
  const sizes = {
    sm: "h-9 px-4 text-xs",
    md: "h-11 px-6 text-sm",
    lg: "h-14 px-8 text-base",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

Button.displayName = "Button";

export default Button;
