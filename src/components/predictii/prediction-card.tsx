"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CircleMinus, Lock, Timer } from "lucide-react";
import { memo, useMemo } from "react";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type { PredictionPublicTeaser } from "@/lib/predictions/teaser-utils";
import type {
  PredictionPayload,
  PredictionSettlement,
} from "@/lib/predictions/types";
import {
  deriveComboVisualSettlement,
  evaluatePickResult,
  marketDisplayRo,
} from "@/lib/predictions/pick-result";
import { deriveLiveProgressRows } from "@/lib/predictions/live-progress";
import type { LiveProgressRow } from "@/lib/predictions/live-progress";
import { liveTotalsFromFixture } from "@/lib/football-api/fixture-live-stats";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { withoutLegacyProbixBookmakerDisclaimer } from "@/lib/probix-engine/explanations-ro";
import { LiveBadge, LIVE_BADGE_TEXT_CLASS } from "@/components/ds/live-badge";
import { MatchTeamsScoreRow } from "@/components/football/match-teams-score-row";
import { PredictionCardLiveMetrics } from "@/components/predictii/prediction-card-live-metrics";
import { cn } from "@/lib/utils";

const TZ = "Europe/Bucharest";

/** Aceeași animație pulse ca în `FixtureRow` (Meciuri). */
const LIVE_STATUS_PULSE = "animate-pulse motion-reduce:animate-none";

/** Ritm vertical între zonele cardului (~8–10px). */
const SECTION_GAP = "gap-2.5";

const UPCOMING_AWAITING_MESSAGE =
  "Predicția pentru acest meci este generată automat cu aproximativ 10 minute înainte de start.";

export type PredictionCardProps = {
  fixture: NormalizedFixture;
  unlocked: boolean;
  prediction?: PredictionPayload;
  teaser?: PredictionPublicTeaser | null;
};

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function formatGeneratedShort(iso: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

function scoreLine(f: NormalizedFixture) {
  if (f.bucket === "upcoming") return { home: "-", away: "-" };
  if (f.homeGoals == null || f.awayGoals == null)
    return { home: "-", away: "-" };
  return { home: String(f.homeGoals), away: String(f.awayGoals) };
}

function resolvePredictionStatusLabel(params: {
  /** User autentificat sau meci terminat → afișăm badge combinație. */
  revealsCombinationOutcome: boolean;
  hasPrediction: boolean;
  backend?: PredictionSettlement;
  derived: ReturnType<typeof deriveComboVisualSettlement>;
  bucket: NormalizedFixture["bucket"];
}): string | null {
  if (!params.revealsCombinationOutcome || !params.hasPrediction) return null;
  if (params.bucket === "upcoming") return "Nu a început";
  const v =
    params.backend && params.backend !== "pending"
      ? params.backend
      : params.derived;
  if (v === "won") return "Combinație validată";
  if (v === "lost") return "Combinație neîndeplinită";
  if (v === "void") return "Combinație anulată";
  return "În evaluare";
}

/** Colț dreapta sus: LIVE (prioritar) sau status combinație - mărit pentru lizibilitate. */
function CardTopStatus({
  fixture,
  predictionStatusLabel,
}: {
  fixture: NormalizedFixture;
  predictionStatusLabel: string | null;
}) {
  if (fixture.bucket === "live") {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        {fixture.minute != null ? (
          <span
            className={cn(
              LIVE_BADGE_TEXT_CLASS,
              "tabular-nums text-destructive",
              LIVE_STATUS_PULSE,
            )}
          >
            {fixture.minute}′
          </span>
        ) : null}
        <LiveBadge className={LIVE_STATUS_PULSE} />
      </span>
    );
  }

  if (!predictionStatusLabel) return null;

  const low = predictionStatusLabel.toLowerCase();
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
        LIVE_BADGE_TEXT_CLASS,
        "inline-flex max-w-[min(20rem,calc(100vw-5rem))] items-center justify-center rounded-lg border-2 px-2.5 py-1 text-center shadow-sm",
        tone,
      )}
      title={predictionStatusLabel}
    >
      {predictionStatusLabel}
    </span>
  );
}

/** Un rând: stânga cotă combinată; dreapta încredere model (aceleași surse ca înainte). */
function CotaIncredereRow({
  combined,
  probPct,
  reduceMotion,
}: {
  combined: number | null;
  probPct: number | null;
  reduceMotion: boolean | null;
}) {
  const p =
    probPct != null
      ? Math.min(100, Math.max(0, Math.round(probPct)))
      : null;

  return (
    <div className="min-w-0 border-t border-border/40 pt-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
            Cotă
          </p>
          {combined != null ? (
            <motion.p
              className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground"
              initial={reduceMotion ? false : { opacity: 0.94 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              aria-label={`Cotă combinată ${combined.toFixed(2)}`}
            >
              {combined.toFixed(2)}
            </motion.p>
          ) : (
            <p className="mt-1.5 max-w-[16rem] text-[13px] leading-relaxed text-foreground/75">
              Cotă combinată indisponibilă pentru acest set.
            </p>
          )}
        </div>

        <div className="flex min-w-[7rem] shrink-0 flex-col items-end text-right sm:min-w-[8.75rem]">
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
            Încredere model
          </p>
          {p != null ? (
            <>
              <motion.p
                className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground"
                initial={reduceMotion ? false : { opacity: 0.94 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                aria-label={`Încredere model ${p} procente`}
              >
                {p}
                <span className="ml-0.5 text-lg font-medium text-foreground-secondary">
                  %
                </span>
              </motion.p>
              <div
                className="mt-2 h-[3px] w-full max-w-[9rem] overflow-hidden rounded-full bg-foreground/[0.06]"
                role="presentation"
              >
                <motion.div
                  className="h-full rounded-full bg-primary/45"
                  initial={reduceMotion ? false : { width: "0%" }}
                  animate={{ width: `${p}%` }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.65,
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                />
              </div>
            </>
          ) : (
            <p className="mt-1.5 max-w-[11rem] text-[13px] leading-relaxed text-foreground/75">
              Indisponibilă.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ComboProgressStrip({ rows }: { rows: LiveProgressRow[] }) {
  const rm = useReducedMotion();
  if (!rows.length) return null;

  return (
    <section
      className="rounded-xl border border-border/50 bg-[rgba(255,255,255,0.02)] px-2.5 py-2 sm:px-3 sm:py-2.5"
      aria-label="Progres predicție față de evenimente live"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted/85">
        Progres selecții
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => {
          const pct =
            row.ratio != null
              ? Math.round(Math.min(1, Math.max(0, row.ratio)) * 100)
              : null;
          const done = row.status === "complete";
          const fail = row.status === "failed";
          const wait = row.status === "awaiting_data";
          const fill = done
            ? "bg-emerald-400/40"
            : fail
              ? "bg-red-400/38"
              : wait
                ? "bg-amber-400/32"
                : "bg-primary/38";

          return (
            <li key={row.id} className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-tight text-foreground">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/82">
                    {row.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-xs tabular-nums",
                    done && "text-emerald-300/85",
                    fail && "text-red-300/82",
                    !done && !fail && "text-foreground-muted/50",
                  )}
                  aria-hidden
                >
                  {done ? "✓" : fail ? "✕" : wait ? "…" : "○"}
                </span>
              </div>
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/50">
                {pct != null ? (
                  <motion.div
                    className={cn("h-full rounded-full", fill)}
                    initial={rm ? false : { width: "0%" }}
                    animate={{ width: `${pct}%` }}
                    transition={
                      rm
                        ? { duration: 0 }
                        : { type: "spring", damping: 42, stiffness: 300 }
                    }
                  />
                ) : (
                  <div
                    className={cn(
                      "h-full w-[12%] rounded-full opacity-40",
                      wait ? "bg-amber-400/25" : "bg-primary/20",
                    )}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PredictionCardInner = ({
  fixture,
  unlocked,
  prediction,
  teaser,
}: PredictionCardProps) => {
  const reduceMotion = useReducedMotion();
  const sc = useMemo(() => scoreLine(fixture), [fixture]);

  const combined =
    prediction?.estimatedCombinedDecimal ??
    (prediction?.picks?.length
      ? combinedDecimalFromPicks(prediction.picks)
      : null);

  const probPct =
    prediction?.confidenceScore ??
    (prediction && prediction.confidenceAvg >= 0
      ? Math.round(prediction.confidenceAvg * 100)
      : null);

  const teaserConf =
    teaser && !unlocked ? teaser.confidenceScore : null;
  const teaserOdds =
    teaser && !unlocked ? teaser.estimatedCombinedDecimal : null;

  const derivedLiveTotals = useMemo(() => liveTotalsFromFixture(fixture), [fixture]);

  const comboVisual = useMemo(
    () =>
      deriveComboVisualSettlement(
        fixture,
        prediction?.picks,
        prediction?.settlement,
        derivedLiveTotals,
      ),
    [fixture, prediction?.picks, prediction?.settlement, derivedLiveTotals],
  );

  const progressRows = useMemo(() => {
    if (!prediction?.picks?.length || fixture.bucket === "upcoming") return [];
    return deriveLiveProgressRows(
      fixture,
      prediction.picks,
      derivedLiveTotals,
    );
  }, [fixture, prediction, derivedLiveTotals]);

  /** Predicții complete: utilizator în cont SAU meci final (combinatie publică rezultat). */
  const fullPredictionReveal =
    unlocked || fixture.bucket === "finished";

  const cardAccent =
    fullPredictionReveal && comboVisual === "won"
      ? "!border-emerald-500/22 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.06)]"
      : fullPredictionReveal && comboVisual === "lost"
        ? "!border-red-500/18 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.05)]"
        : undefined;

  const showPredictionLock = !fullPredictionReveal;
  const hasTeaserOutline = Boolean(teaser) && showPredictionLock;

  const metaTime =
    fullPredictionReveal && prediction?.generatedAt ? (
      <time
        dateTime={prediction.generatedAt}
        className="inline text-[11px] tabular-nums text-foreground/85"
      >
        {formatGeneratedShort(prediction.generatedAt)}
      </time>
    ) : (
      <time
        className="inline text-[11px] tabular-nums text-foreground/85"
        dateTime={fixture.kickoffIso}
      >
        {formatClock(fixture.kickoffIso)}
      </time>
    );

  const showPredictionBody =
    fullPredictionReveal && prediction?.picks?.length;

  const predictionStatusLabel = resolvePredictionStatusLabel({
    revealsCombinationOutcome: fullPredictionReveal,
    hasPrediction: Boolean(prediction?.picks?.length),
    backend: prediction?.settlement,
    derived: comboVisual,
    bucket: fixture.bucket,
  });

  const hideIntelForUpcomingAwaiting =
    fixture.bucket === "upcoming" &&
    fullPredictionReveal &&
    !prediction?.picks?.length;

  const analysisBulletsShown =
    prediction?.explanationBullets?.length ?
      withoutLegacyProbixBookmakerDisclaimer(
        prediction.explanationBullets,
      ).slice(0, 5)
    : [];

  /** Același limbaj vizual ca „Analiză” / teaser — fără chenar gradient suplimentar în card. */
  const upcomingAwaitingIntel =
    fullPredictionReveal &&
    !prediction?.picks?.length &&
    fixture.bucket === "upcoming";

  return (
    <article
      id={`probix-fixture-${fixture.id}`}
      className={cn(
        "pb-prediction-card-shell group/card flex min-w-0 flex-col",
        SECTION_GAP,
        "p-3 sm:p-3 md:p-3.5",
        cardAccent,
      )}
      aria-label={`${fixture.leagueName}. ${fixture.homeName} – ${fixture.awayName}. ${fixture.statusShort}`}
    >
      {/* 1 · TOP META */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 shrink text-[11px] leading-none">
          {!fullPredictionReveal || !prediction?.generatedAt ? (
            <>
              <span className="text-foreground-muted/75">Programat · </span>
              {metaTime}
            </>
          ) : (
            <>
              <span className="text-foreground-muted/75">Generat · </span>
              <time
                dateTime={prediction.generatedAt}
                className="inline tabular-nums text-foreground/85"
              >
                {formatGeneratedShort(prediction.generatedAt)}
              </time>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <CardTopStatus
            fixture={fixture}
            predictionStatusLabel={predictionStatusLabel}
          />
        </div>
      </div>

      <div className="h-px w-full bg-border/35" aria-hidden />

      {/* 2 · MATCH CENTER - fără chenar; separator după echipe */}
      <section className="min-w-0" aria-label="Meci">
        <div className="mx-auto w-full max-w-lg py-2 sm:py-2.5">
          <MatchTeamsScoreRow
            homeName={fixture.homeName}
            awayName={fixture.awayName}
            homeLogo={fixture.homeLogo}
            awayLogo={fixture.awayLogo}
            center={
              <>
                <span className="min-w-[1.25rem] text-center text-lg font-semibold leading-none tabular-nums text-foreground">
                  {sc.home}
                </span>
                <span className="text-foreground-muted">:</span>
                <span className="min-w-[1.25rem] text-center text-lg font-semibold leading-none tabular-nums text-foreground">
                  {sc.away}
                </span>
              </>
            }
          />
        </div>
      </section>

      <div className="h-px w-full bg-border/35" aria-hidden />

      {showPredictionLock && hasTeaserOutline ? (
        <div className="rounded-xl border border-border/45 bg-muted/15 px-3 py-2 sm:px-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-foreground/88">
            {teaserConf != null ? (
              <span>
                Încredere indicativă{" "}
                <span className="font-semibold tabular-nums text-foreground/92">
                  {teaserConf}%
                </span>
              </span>
            ) : null}
            {teaserOdds != null ? (
              <span className={cn(teaserConf != null && "sm:border-l sm:border-border/50 sm:pl-6")}>
                Cotă estimată{" "}
                <span className="font-semibold tabular-nums text-foreground/92">
                  {teaserOdds.toFixed(2)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {!showPredictionLock && fixture.bucket !== "upcoming" ? (
        <PredictionCardLiveMetrics fixture={fixture} />
      ) : null}

      {/* 3 · PREDICȚIE - strat inteligență; starea „publicare în curând” folosește același chip ca restul cardului */}
      <section
        className={cn(
          "relative isolate min-w-0 overflow-hidden",
          upcomingAwaitingIntel
            ? "rounded-xl border border-border/40 bg-muted/10"
            : [
                "rounded-2xl border border-white/[0.09]",
                "bg-gradient-to-br from-muted/[0.28] via-background/55 to-muted/[0.14]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_36px_-20px_rgba(0,0,0,0.55)]",
              ],
        )}
      >
        {showPredictionLock ? (
          <div className="relative overflow-hidden px-4 py-6 sm:px-5 sm:py-7 md:py-8">
            <div className="pointer-events-none select-none blur-xl" aria-hidden>
              <div className="space-y-1.5 p-3">
                {Array.from({
                  length: Math.min(teaser?.pickCount ?? 2, 4),
                }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 rounded-xl border border-border/40 bg-muted/20"
                  />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 z-[1] flex flex-col justify-center px-4 text-center sm:px-5">
              <div className="mx-auto flex max-w-[22rem] flex-col items-center gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/55 bg-muted/25 text-primary"
                  aria-hidden
                >
                  <Lock className="size-6" strokeWidth={1.75} />
                </div>
                <p className="text-pretty text-sm leading-relaxed text-foreground-secondary">
                  Este necesară{" "}
                  <span className="font-semibold text-foreground/90">autentificarea</span> pentru a vedea
                  selecțiile complete la meciurile în curs sau înainte de fluierul de final.
                </p>
              </div>
            </div>
          </div>
        ) : fullPredictionReveal && !prediction?.picks?.length ? (
          <div className="min-w-0 text-foreground/88">
            {fixture.bucket === "upcoming" ? (
              <div className="flex w-full min-w-0 flex-col items-center justify-center gap-5 px-4 py-10 text-center sm:px-6 sm:py-12 md:px-8">
                <Timer
                  className="size-6 shrink-0 text-primary/70"
                  aria-hidden
                />
                <p className="w-full max-w-none text-pretty text-sm leading-[1.65] text-foreground/90 sm:text-[13px] sm:leading-relaxed">
                  {UPCOMING_AWAITING_MESSAGE}
                </p>
              </div>
            ) : fixture.bucket === "live" ? (
              <div className="flex min-w-0 flex-col px-4 py-3.5 sm:px-5 sm:py-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                  Predicție
                </p>
                <ul className="mt-2.5 flex min-w-0 flex-col divide-y divide-border/35">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 py-2 first:pt-1"
                      aria-hidden
                    >
                      <span className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-md border border-dashed border-border/50 text-[10px] font-medium tabular-nums text-foreground-muted/55">
                        …
                      </span>
                      <div className="h-[1.125rem] min-w-0 flex-1 rounded-md bg-foreground/[0.07]" />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-border/40 pt-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 opacity-55">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">
                        Cotă
                      </p>
                      <p className="mt-1.5 font-medium tabular-nums text-[13px] text-foreground/75">
                        —
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">
                        Încredere model
                      </p>
                      <p className="mt-1.5 font-medium tabular-nums text-[13px] text-foreground/75">
                        —
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2.5 rounded-lg border border-border/35 bg-muted/10 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/85">
                  <Timer
                    className="mt-0.5 size-4 shrink-0 text-primary/70"
                    aria-hidden
                  />
                  <p className="min-w-0">
                    Predicția Probix indisponibilă pentru acest meci.{" "}
                    <span className="font-medium text-foreground/90">
                      „Meci în cifre” de mai sus
                    </span>{" "}
                    rămâne actualizat; reîncearcă după rularea cron‑ului sau reîncarcă pagina.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 p-3.5 text-[13px] leading-relaxed text-foreground/88 sm:p-4">
                <CircleMinus
                  className="mt-0.5 size-4 shrink-0 text-foreground/55"
                  aria-hidden
                />
                <p className="min-w-0">
                  Nu există predicție Probix salvată pentru acest rezultat final și data
                  afișată.
                </p>
              </div>
            )}
          </div>
        ) : (
          showPredictionBody && (
            <div className="flex flex-col px-4 py-3.5 sm:px-5 sm:py-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                Predicție
              </p>
              <ul className="mt-2.5 flex min-w-0 flex-col divide-y divide-border/35">
                {prediction!.picks!.map((p, i) => {
                  const res = evaluatePickResult(
                    fixture,
                    p,
                    derivedLiveTotals,
                  );
                  const ro = marketDisplayRo(p);
                  const mark =
                    res === "won"
                      ? "✓"
                      : res === "lost"
                        ? "✕"
                        : res === "void"
                          ? "-"
                          : "○";
                  const tone =
                    res === "won"
                      ? "text-emerald-300/90"
                      : res === "lost"
                        ? "text-red-300/85"
                        : "text-foreground-muted/45";
                  const statusAria =
                    res === "won"
                      ? "Îndeplinită"
                      : res === "lost"
                        ? "Neîndeplinită"
                        : res === "void"
                          ? "Anulată"
                          : "În evaluare";

                  return (
                    <li
                      key={`${p.marketId ?? ro.market}-${i}`}
                      className="flex items-center gap-3 py-2 first:pt-1"
                      aria-label={`${ro.selection}. ${statusAria}.`}
                    >
                      <span
                        className={cn(
                          "flex size-[1.375rem] shrink-0 items-center justify-center rounded-md border border-border/50 text-xs font-semibold tabular-nums",
                          tone,
                        )}
                        aria-hidden
                      >
                        {mark}
                      </span>
                      <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug tracking-tight text-foreground">
                        {ro.selection}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <CotaIncredereRow
                combined={combined}
                probPct={probPct}
                reduceMotion={reduceMotion}
              />
            </div>
          )
        )}
      </section>

      {!showPredictionLock && progressRows.length > 0 ? (
        <ComboProgressStrip rows={progressRows} />
      ) : null}

      {!showPredictionLock &&
      !hideIntelForUpcomingAwaiting &&
      analysisBulletsShown.length ? (
        <section className="rounded-xl border border-border/40 bg-muted/10 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
            Analiză
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-foreground/88 [&>li]:max-w-prose [&>li]:text-pretty">
            {analysisBulletsShown.map((line, ix) => (
              <li key={`${ix}-${line.slice(0, 48)}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {showPredictionLock && teaser ? (
        <div className="relative overflow-hidden rounded-xl border border-border/40 px-2.5 py-2">
          <div className="blur-md select-none" aria-hidden>
            <p className="text-[13px] leading-relaxed text-foreground-secondary">
              Context ofensiv, cornere cumulative și distribuție cartonașe din feed
              live…
            </p>
          </div>
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50 px-4 text-center text-[11px] font-medium text-foreground-muted backdrop-blur-sm">
            Autentificare necesară
          </p>
        </div>
      ) : null}
    </article>
  );
};

export const PredictionCard = memo(PredictionCardInner);
