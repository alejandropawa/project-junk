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

/** Aliniat la statusurile combinației din `prediction-card.tsx`. */
function comboOutcomeLabel(settlement: PredictionSettlement | undefined): string {
  const v = settlement ?? "pending";
  if (v === "won") return "Combinație validată";
  if (v === "lost") return "Combinație neîndeplinită";
  if (v === "void") return "Combinație anulată";
  return "În evaluare";
}

/** Chenar rezultat colț dreapta sus (în afara predicției blur). */
function ComboBadge({ settlement }: { settlement: PredictionSettlement | undefined }) {
  const label = comboOutcomeLabel(settlement);
  if (label === "În evaluare") return null;

  const low = label.toLowerCase();
  const tone =
    low.includes("validată")
      ? "border-emerald-400/45 bg-emerald-500/[0.14] text-emerald-50"
      : low.includes("neîndeplinită")
        ? "border-red-400/40 bg-red-500/[0.12] text-red-50"
        : low.includes("anulată")
          ? "border-amber-400/35 bg-amber-500/[0.12] text-amber-50"
          : "border-border/60 bg-muted/40 text-foreground";

  return (
    <span
      className={cn(
        "inline-flex max-w-[min(18rem,calc(100vw-6rem))] items-center justify-center rounded-lg border-2 px-2 py-0.5 text-center text-[11px] font-semibold leading-snug tracking-tight shadow-sm tabular-nums",
        tone,
      )}
      title={label}
    >
      {label}
    </span>
  );
}

export function HistoricPredictionCard({ row }: { row: PredictionReportRow }) {
  const { payload } = row;
  const picks = payload.picks ?? [];
  const settlement = payload.settlement ?? "pending";
  const combined =
    payload.estimatedCombinedDecimal ?? combinedDecimalFromPicks(picks);

  const probPct =
    payload.confidenceScore ??
    (payload.confidenceAvg != null && payload.confidenceAvg >= 0
      ? Math.min(100, Math.max(0, Math.round(payload.confidenceAvg * 100)))
      : null);

  const cardAccent =
    settlement === "won"
      ? "!border-emerald-500/22 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.06)]"
      : settlement === "lost"
        ? "!border-red-500/18 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.05)]"
        : undefined;

  return (
    <article
      className={cn(
        "pb-prediction-card-shell group/card flex min-w-0 flex-col gap-2.5 p-3 sm:p-3 md:p-3.5",
        cardAccent,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 shrink text-[11px] font-medium uppercase tracking-wider text-foreground/70">
          {row.league_name}
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <time
            className="tabular-nums text-[11px] text-foreground/85"
            dateTime={row.kickoff_iso}
          >
            {formatKickoff(row.kickoff_iso)}
          </time>
          <ComboBadge settlement={settlement} />
        </div>
      </div>

      <div className="h-px w-full bg-border/35" aria-hidden />

      <section aria-label="Echipe">
        <p className="text-center text-[15px] font-semibold leading-snug tracking-tight text-foreground">
          {row.home_name}
          <span className="mx-1.5 font-normal text-foreground-muted">–</span>
          {row.away_name}
        </p>
        {settlement === "pending" ? (
          <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-wider text-foreground-muted/90">
            {comboOutcomeLabel(settlement)}
          </p>
        ) : null}
      </section>

      <div className="h-px w-full bg-border/35" aria-hidden />

      <section
        className={cn(
          "relative isolate min-w-0 overflow-hidden rounded-2xl border border-white/[0.09]",
          "bg-gradient-to-br from-muted/[0.28] via-background/55 to-muted/[0.14]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_36px_-20px_rgba(0,0,0,0.55)]",
        )}
        aria-label="Predicție"
      >
        <div className="flex flex-col px-4 py-3.5 sm:px-5 sm:py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
            Predicție
          </p>
          <ul className="mt-2.5 flex min-w-0 flex-col divide-y divide-border/35">
            {picks.map((p, i) => (
              <li
                key={`${p.marketId ?? p.marketLabel}-${i}`}
                className="py-2 first:pt-1 text-[15px] font-medium leading-snug tracking-tight text-foreground"
              >
                {p.selection}
                {Number.isFinite(p.decimal) && p.decimal > 1 ? (
                  <span className="ml-2 tabular-nums text-sm font-normal text-foreground-muted">
                    @{p.decimal.toFixed(2)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border/40 pt-2.5">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                  Cotă
                </p>
                {combined != null ? (
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {combined.toFixed(2)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-foreground/75">—</p>
                )}
              </div>
              <div className="flex min-w-[7rem] shrink-0 flex-col items-end text-right sm:min-w-[8.75rem]">
                <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                  Încredere model
                </p>
                {probPct != null ? (
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {probPct}
                    <span className="ml-0.5 text-lg font-medium text-foreground-secondary">
                      %
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-foreground/75">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
