"use client";

import type { PredictionReportRow } from "@/lib/predictions/prediction-repository";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type { PredictionSettlement } from "@/lib/predictions/types";
import { cn } from "@/lib/utils";

const TZ = "Europe/Bucharest";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function settlementLabel(s: PredictionSettlement | undefined): string {
  const v = s ?? "pending";
  if (v === "won") return "Combinatie validată";
  if (v === "lost") return "Combinatie neîndeplinită";
  if (v === "void") return "Combinatie anulată";
  return "În evaluare";
}

export function HistoricPredictionCard({ row }: { row: PredictionReportRow }) {
  const { payload } = row;
  const settlement = payload.settlement ?? "pending";
  const combined =
    payload.estimatedCombinedDecimal ??
    combinedDecimalFromPicks(payload.picks ?? []);

  const tone =
    settlement === "won"
      ? "border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-50"
      : settlement === "lost"
        ? "border-red-400/30 bg-red-500/[0.08] text-red-50"
        : settlement === "void"
          ? "border-amber-400/30 bg-amber-500/[0.08] text-amber-50"
          : "border-border/50 bg-muted/25 text-foreground-secondary";

  return (
    <article
      className={cn(
        "rounded-xl border px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5",
        tone,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted/90">
          {row.league_name}
        </p>
        <time
          className="tabular-nums text-[11px] text-foreground-secondary"
          dateTime={row.kickoff_iso}
        >
          {formatKickoff(row.kickoff_iso)}
        </time>
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
        {row.home_name}{" "}
        <span className="mx-1 font-normal text-foreground-muted">–</span>{" "}
        {row.away_name}
      </p>

      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-foreground-muted/85">
        Predicție
      </p>
      <ul className="mt-1.5 space-y-1.5 text-[13px] leading-snug text-foreground-secondary [&>li]:text-pretty">
        {(payload.picks ?? []).map((p, i) => (
          <li key={`${p.marketLabel}-${i}`}>
            <span className="text-foreground/95">{p.selection}</span>
            <span className="tabular-nums text-foreground-muted">
              {" "}
              @
              {Number.isFinite(p.decimal) && p.decimal > 1
                ? p.decimal.toFixed(2)
                : "–"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/35 pt-2.5 text-[13px]">
        <span className={cn("font-medium", settlement === "pending" && "text-foreground-muted")}>
          {settlementLabel(settlement)}
        </span>
        {combined != null ? (
          <span className="tabular-nums text-foreground-secondary">
            Cotă combinată{" "}
            <span className="font-semibold text-foreground">{combined.toFixed(2)}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}
