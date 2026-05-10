"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
};

export function Tooltip({ label, children, side = "top", className }: TooltipProps) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? `tip-${id}` : undefined}>{children}</span>
      {open && (
        <span
          id={`tip-${id}`}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 min-w-max max-w-xs rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-foreground-secondary shadow-[var(--shadow-pb-card)]",
            side === "top" ? "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2" : "top-[calc(100%+6px)] left-1/2 -translate-x-1/2",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
