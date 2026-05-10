"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { FixtureLiveStatsSplit } from "@/lib/football-api/types";
import { cn } from "@/lib/utils";

type Num = number | null | undefined;

function definedNumber(n: Num): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function SplitBarCounts({
  home,
  away,
  reduceMotion,
  thin,
}: {
  home: number;
  away: number;
  reduceMotion: boolean | null;
  thin?: boolean;
}) {
  const safeH = Math.max(0, home);
  const safeA = Math.max(0, away);
  const tot = Math.max(1e-9, safeH + safeA);
  const leftPct = (safeH / tot) * 100;
  const hClass = thin ? "h-[3px]" : "h-[5px]";

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-white/[0.05]",
        hClass,
      )}
      role="presentation"
    >
      <motion.div
        className={cn(
          "shrink-0 rounded-full bg-primary/75",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        )}
        initial={reduceMotion ? false : { width: "0%" }}
        animate={{
          width: `${Math.min(100, Math.max(0, leftPct))}%`,
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 38, stiffness: 280 }
        }
      />
      <div className="h-full min-w-0 flex-1 rounded-full bg-sky-400/42" aria-hidden />
    </div>
  );
}

type Props = {
  split: FixtureLiveStatsSplit;
  /** Aspect „dashboard” subtire - mai puțină greutate vizuală. */
  density?: "default" | "compact";
};

export function LiveMatchStatsBars({
  split,
  density = "default",
}: Props) {
  const reduceMotion = useReducedMotion();
  const compact = density === "compact";
  const h = split.home;
  const a = split.away;

  const rows: {
    key: string;
    label: string;
    home: number;
    away: number;
    possession: boolean;
  }[] = [];

  const hp = h.possessionPct;
  const ap = a.possessionPct;
  if (definedNumber(hp) && definedNumber(ap)) {
    rows.push({
      key: "possession",
      label: "Posesie %",
      home: Math.max(0, hp!),
      away: Math.max(0, ap!),
      possession: true,
    });
  }

  const pushCounts = (
    key: string,
    label: string,
    hn: Num,
    an: Num,
  ) => {
    if (!definedNumber(hn) && !definedNumber(an)) return;
    rows.push({
      key,
      label,
      home: definedNumber(hn) ? Math.max(0, hn!) : 0,
      away: definedNumber(an) ? Math.max(0, an!) : 0,
      possession: false,
    });
  };

  pushCounts("corners", "Cornere", h.corners, a.corners);
  pushCounts("fouls", "Faulturi", h.fouls, a.fouls);
  pushCounts(
    "danger",
    "Atacuri periculoase",
    h.dangerousAttacks,
    a.dangerousAttacks,
  );
  pushCounts("attacks", "Atacuri", h.attacksNormal, a.attacksNormal);
  pushCounts("sot", "Șuturi pe poartă", h.shotsOnGoal, a.shotsOnGoal);
  pushCounts(
    "shots",
    "Șuturi (total)",
    h.shotsTotal,
    a.shotsTotal,
  );

  const hasCardH = h.yellowCards != null || h.redCards != null;
  const hasCardA = a.yellowCards != null || a.redCards != null;
  if (hasCardH || hasCardA) {
    rows.push({
      key: "cards",
      label: "Cartonașe (g+r)",
      home: (h.yellowCards ?? 0) + (h.redCards ?? 0),
      away: (a.yellowCards ?? 0) + (a.redCards ?? 0),
      possession: false,
    });
  }

  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-white/[0.05]",
        compact
          ? "bg-white/[0.015] p-4"
          : "bg-white/[0.022] p-5",
      )}
    >
      <p className={cn(compact ? "pb-3" : "pb-4", "text-[11px] font-medium uppercase tracking-[0.12em] text-foreground-muted/90")}>
        Date meci · API live
      </p>
      <ul className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
        {rows.map((r) => (
          <li key={r.key} className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3 tabular-nums">
              <span className={cn(compact ? "text-xs" : "text-sm", "min-w-[1.75rem] font-semibold text-primary tabular-nums")}>
                {r.possession ? Math.round(r.home) : r.home}
              </span>
              <span className="min-w-0 flex-1 truncate text-center text-[10px] font-medium uppercase tracking-wide text-foreground-muted/85">
                {r.label}
              </span>
              <span className={cn(compact ? "text-xs" : "text-sm", "min-w-[1.75rem] text-right font-semibold tabular-nums text-sky-300/85")}>
                {r.possession ? Math.round(r.away) : r.away}
              </span>
            </div>
            <SplitBarCounts
              home={r.home}
              away={r.away}
              reduceMotion={reduceMotion}
              thin={compact}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
