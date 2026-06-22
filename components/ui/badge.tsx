import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-base px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-dark-text", className)}
      {...props}
    />
  );
}
