"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  CircleMinus,
  ListChecks,
  Lock,
  Timer,
  TrendingUp,
} from "lucide-react";
import { memo, useMemo } from "react";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type { PredictionPublicTeaser } from "@/lib/predictions/teaser-utils";
import type {
  PredictionPayload,
  PredictionSettlement,
} from "@/lib/predictions/types";
import {
  deriveComboVisualSettlement,
  marketDisplayRo,
  predictionPickLineRo,
} from "@/lib/predictions/pick-result";
import { deriveLiveProgressRows } from "@/lib/predictions/live-progress";
import type { LiveProgressRow } from "@/lib/predictions/live-progress";
import { liveTotalsFromFixture } from "@/lib/football-api/fixture-live-stats";
import { liveFixtureClockLabel } from "@/lib/football-api/live-clock-display";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { LiveBadge, LIVE_BADGE_TEXT_CLASS } from "@/components/ds/live-badge";
import { MatchTeamsScoreRow } from "@/components/football/match-teams-score-row";
import { PredictionCardLiveMetrics } from "@/components/predictii/prediction-card-live-metrics";
import { cn } from "@/lib/utils";

const TZ = "Europe/Bucharest";

/** Aceeași animație pulse ca în `FixtureRow` (Meciuri). */
const LIVE_STATUS_PULSE = "animate-pulse motion-reduce:animate-none";

/** Ritm vertical între zonele cardului (~8–10px). */
const SECTION_GAP = "gap-2.5";

/**
 * Chenar Predicție (selecții + cotă/încredere) și „Progres selecții”.
 * Mai închis decât `pb-prediction-card-shell` ca să evidențieze conținutul principal.
 */
const HERO_PREDICTION_INNER =
  "rounded-xl border border-white/[0.06] bg-black/[0.2] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-black/[0.25]";

/** Înveliș gradient când predicția e blocată (auth). */
const PREDICTION_LOCKED_GRADIENT =
  "rounded-2xl border border-white/[0.06] bg-gradient-to-br from-black/[0.2] via-zinc-950/28 to-black/[0.19] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_36px_-20px_rgba(0,0,0,0.55)]";

/** Chenar discret: așteptăm predicție / guest upcoming cu teaser. */
const PREDICTION_AWAITING_SHELL =
  "rounded-xl border border-white/[0.05] bg-black/[0.14] dark:bg-black/[0.17]";

/** Aliniere ca `FixtureRow` (Meciuri): minut centru, LIVE dreapta, deasupra rândului scor. */
const MATCH_STATUS_ROW =
  "flex min-w-0 items-center gap-x-2 sm:gap-x-4";
const MATCH_SIDE = "flex min-w-0 min-h-0 flex-1";
const MATCH_MID =
  "w-[4.25rem] shrink-0 flex-none px-1 sm:w-20";

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
  /** La FT: din datele curente ale meciului (poate depăși `settlement` din DB până la reparare cron). */
  derived: ReturnType<typeof deriveComboVisualSettlement>;
  bucket: NormalizedFixture["bucket"];
}): string | null {
  if (!params.revealsCombinationOutcome || !params.hasPrediction) return null;
  if (params.bucket === "upcoming") return "Nu a început";
  let v: ReturnType<typeof deriveComboVisualSettlement>;
  if (params.bucket === "finished") {
    v =
      params.derived !== "pending"
        ? params.derived
        : params.backend && params.backend !== "pending"
          ? params.backend
          : "pending";
  } else {
    v =
      params.backend && params.backend !== "pending"
        ? params.backend
        : params.derived;
  }
  if (v === "won") return "Combinație validată";
  if (v === "lost") return "Combinație neîndeplinită";
  if (v === "void") return "Combinație anulată";
  return "În evaluare";
}

/** Colț dreapta sus: status combinație (live: minut + badge sunt deasupra scorului). */
function CardTopStatus({
  predictionStatusLabel,
}: {
  predictionStatusLabel: string | null;
}) {
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

/** Etichete tip grid stat din hero landing. */
const HERO_STAT_LABEL =
  "break-words text-[10px] font-medium uppercase leading-tight tracking-wide text-foreground-muted";

/** Un rând: stânga cotă combinată; dreapta încredere (aceleași surse ca înainte). */
function CotaIncredereRow({
  combined,
  probPct,
  reduceMotion,
  visual = "card",
}: {
  combined: number | null;
  probPct: number | null;
  reduceMotion: boolean | null;
  /** `hero` — tipografie ca în hero (font mono, etichete mici). */
  visual?: "card" | "hero";
}) {
  const p =
    probPct != null
      ? Math.min(100, Math.max(0, Math.round(probPct)))
      : null;

  const hero = visual === "hero";
  const valueClass = hero
    ? "mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.65rem]"
    : "mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground";
  const labelClass = hero ? HERO_STAT_LABEL : "text-[11px] font-medium uppercase tracking-wider text-foreground/70";
  const wrapClass = hero
    ? "min-w-0 border-t border-border/50 pt-3 mt-3"
    : "min-w-0 border-t border-border/40 pt-2.5";

  return (
    <div className={wrapClass}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className={labelClass}>Cotă</p>
          {combined != null ? (
            <motion.p
              className={valueClass}
              initial={reduceMotion ? false : { opacity: 0.94 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              aria-label={`Cotă combinată ${combined.toFixed(2)}`}
            >
              {combined.toFixed(2)}
            </motion.p>
          ) : (
            <p
              className={cn(
                "max-w-[16rem] leading-relaxed text-foreground/75",
                hero ? "mt-1 text-[13px]" : "mt-1.5 text-[13px]",
              )}
            >
              Cotă combinată indisponibilă pentru acest set.
            </p>
          )}
        </div>

        <div className="flex min-w-[7rem] shrink-0 flex-col items-end text-right sm:min-w-[8.75rem]">
          <p className={labelClass}>Încredere</p>
          {p != null ? (
            <motion.p
              className={valueClass}
              initial={reduceMotion ? false : { opacity: 0.94 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              aria-label={`Încredere ${p} procente`}
            >
              {p}
              <span
                className={cn(
                  "ml-0.5 font-medium text-foreground-secondary",
                  hero ? "text-base" : "text-lg",
                )}
              >
                %
              </span>
            </motion.p>
          ) : (
            <p
              className={cn(
                "max-w-[11rem] leading-relaxed text-foreground/75",
                hero ? "mt-1 text-[13px]" : "mt-1.5 text-[13px]",
              )}
            >
              Indisponibilă.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Procent umplere bară: 100% la îndeplinire; min. subțire când e progres dar nu 0 la țintă. */
const PROGRESS_BAR_MIN_PCT = 5;

function progressBarFillPercent(row: LiveProgressRow): number {
  if (row.status === "complete") return 100;
  if (row.status === "failed") {
    const r =
      row.ratio != null
        ? Math.round(Math.min(1, Math.max(0, row.ratio)) * 100)
        : 0;
    return Math.max(PROGRESS_BAR_MIN_PCT, r);
  }
  if (row.status === "awaiting_data" || row.ratio == null) {
    return PROGRESS_BAR_MIN_PCT + 3;
  }
  /**
   * Peste linie (goluri, cornere, etc.): la 0 față de țintă (ex. 0/3) — pistă goală,
   * nu bară „minimă” care sugerează progres inexistent.
   */
  if (row.status === "pending" && row.ratio === 0) {
    return 0;
  }
  const r = Math.round(Math.min(1, Math.max(0, row.ratio)) * 100);
  return Math.max(PROGRESS_BAR_MIN_PCT, Math.min(99, r));
}

function progressStatusLabel(row: LiveProgressRow) {
  switch (row.status) {
    case "complete":
      return (
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-success">
          <span className="text-base leading-none">✓</span>
          îndeplinită
        </span>
      );
    case "failed":
      return (
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-red-400/90">
          <span className="text-base leading-none">✕</span>
          neîndeplinită
        </span>
      );
    case "awaiting_data":
      return (
        <span className="shrink-0 font-medium text-foreground-muted">
          aștept date
        </span>
      );
    default:
      return (
        <span className="shrink-0 font-medium text-foreground-muted">
          în curs
        </span>
      );
  }
}

function ComboProgressStrip({ rows }: { rows: LiveProgressRow[] }) {
  const rm = useReducedMotion();
  if (!rows.length) return null;

  return (
    <section
      className={HERO_PREDICTION_INNER}
      aria-label="Progres predicție față de evenimente live"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-foreground/70">
          Progres selecții
        </p>
        <ListChecks className="size-4 shrink-0 text-primary/80" aria-hidden />
      </div>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => {
          const pct = progressBarFillPercent(row);
          const fail = row.status === "failed";
          const wait = row.status === "awaiting_data";
          const fill = fail
            ? "bg-red-400/45"
            : wait
              ? "bg-amber-400/40"
              : "bg-gradient-to-r from-primary/80 to-probix-purple/70";
          const showDetail = row.detail.trim().length > 0;

          return (
            <li key={row.id} className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[13px]">
                <span className="min-w-0 flex-1 text-foreground-secondary">
                  {row.label}
                </span>
                {progressStatusLabel(row)}
              </div>
              {showDetail ? (
                <p className="text-[13px] leading-relaxed text-foreground-muted">
                  {row.detail}
                </p>
              ) : null}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
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
  const liveClockLabel =
    fixture.bucket === "live" ? liveFixtureClockLabel(fixture) : null;

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

  /**
   * La FT ignorăm `payload.settlement` pentru chenar + badge: rămâne aliniat la API-ul curent
   * (ex. cornere corectate după fluier). DB se aliniază prin `settle-predictions?repair=1`.
   */
  const comboVisual = useMemo(() => {
    if (fixture.bucket === "finished" && prediction?.picks?.length) {
      return deriveComboVisualSettlement(
        fixture,
        prediction.picks,
        undefined,
        derivedLiveTotals,
      );
    }
    return deriveComboVisualSettlement(
      fixture,
      prediction?.picks,
      prediction?.settlement,
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
  /**
   * Vizitator + urmează + există predicție (teaser / picioare): același layout ca „fără predicție încă”
   * — fără cote indicative, fără blur autentificare în chenarul principal.
   */
  const guestUpcomingHasPredTeaser =
    fixture.bucket === "upcoming" &&
    showPredictionLock &&
    (Boolean(teaser) || Boolean(prediction?.picks?.length));
  /** Vizitator neautentificat la meci live: fără teaser cote / fără chenar „autentificare necesară”. */
  const lockedLiveGuest =
    showPredictionLock && fixture.bucket === "live";

  /**
   * „Meci în cifre”: ascuns la meci neînceput fără predicție (altfel doar zerouri / fără sens).
   * Cu predicție (pre-live) sau live/final — afișăm ca înainte.
   */
  const showMeciInCifre =
    !showPredictionLock &&
    (fixture.bucket !== "upcoming" || Boolean(prediction?.picks?.length));

  const progressRowsForStrip = useMemo(() => {
    if (!prediction?.picks?.length) return [];
    return deriveLiveProgressRows(
      fixture,
      prediction.picks,
      derivedLiveTotals,
    );
  }, [fixture, prediction, derivedLiveTotals]);

  /** Aceeași bandă status + scor ca la live; la „Urmează” (user cu predicție) centrul = ora de start. */
  const showMatchStatusBand =
    fixture.bucket === "live" ||
    (fixture.bucket === "upcoming" &&
      !showPredictionLock &&
      Boolean(prediction?.picks?.length));

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

  /** Fără chenar gradient suplimentar în card când așteptăm predicția pre-meci. */
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
          {fixture.bucket === "live" ? (
            <LiveBadge className={LIVE_STATUS_PULSE} />
          ) : (
            <CardTopStatus predictionStatusLabel={predictionStatusLabel} />
          )}
        </div>
      </div>

      <div className="h-px w-full bg-border/35" aria-hidden />

      {/* 2 · MATCH CENTER - live: minut + LIVE deasupra scorului (ca Meciuri); separator după echipe */}
      <section className="min-w-0" aria-label="Meci">
        <div className="mx-auto w-full max-w-lg py-2 sm:py-2.5">
          {showMatchStatusBand ? (
            <div className="flex flex-col gap-y-2">
              <div className={MATCH_STATUS_ROW}>
                <div aria-hidden className={cn(MATCH_SIDE, "min-h-7")} />
                <div
                  className={cn(
                    MATCH_MID,
                    "flex min-h-7 flex-col items-center justify-center",
                  )}
                >
                  {fixture.bucket === "live" && liveClockLabel ? (
                    <span
                      className={cn(
                        "block text-center text-xs font-medium text-destructive",
                        liveClockLabel.endsWith("′")
                          ? "tabular-nums"
                          : "tracking-tight",
                        LIVE_STATUS_PULSE,
                      )}
                    >
                      {liveClockLabel}
                    </span>
                  ) : fixture.bucket === "upcoming" ? (
                    <span className="block text-center text-xs font-medium tabular-nums tracking-tight text-foreground-muted">
                      {formatClock(fixture.kickoffIso)}
                    </span>
                  ) : null}
                </div>
                <div aria-hidden className={cn(MATCH_SIDE, "min-h-7")} />
              </div>
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
          ) : (
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
          )}
        </div>
      </section>

      <div className="h-px w-full bg-border/35" aria-hidden />

      {showPredictionLock &&
      hasTeaserOutline &&
      !lockedLiveGuest &&
      !guestUpcomingHasPredTeaser ? (
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

      {showMeciInCifre ? (
        <PredictionCardLiveMetrics fixture={fixture} />
      ) : null}

      {/* 3 · PREDICȚIE — vizitator la live: doar mesaj autentificare (fără teaser / blur picioare) */}
      {lockedLiveGuest ? (
        <section
          className={cn(
            "relative isolate min-w-0 overflow-hidden",
            PREDICTION_LOCKED_GRADIENT,
          )}
        >
          <div className="mx-auto flex max-w-[22rem] flex-col items-center gap-3 px-4 py-6 text-center sm:px-5 sm:py-7 md:py-8">
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
        </section>
      ) : (
        <section
          className={cn(
            "relative isolate min-w-0 overflow-hidden",
            showPredictionBody
              ? HERO_PREDICTION_INNER
              : upcomingAwaitingIntel || guestUpcomingHasPredTeaser
                ? PREDICTION_AWAITING_SHELL
                : PREDICTION_LOCKED_GRADIENT,
          )}
        >
        {showPredictionLock && guestUpcomingHasPredTeaser ? (
          <div className="flex w-full min-w-0 flex-col items-center justify-center gap-5 px-4 py-10 text-center sm:px-6 sm:py-12 md:px-8">
            <Timer
              className="size-6 shrink-0 text-primary/70"
              aria-hidden
            />
            <p className="w-full max-w-none text-pretty text-sm leading-[1.65] text-foreground/90 sm:text-[13px] sm:leading-relaxed">
              {UPCOMING_AWAITING_MESSAGE}
            </p>
          </div>
        ) : showPredictionLock ? (
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
                        Încredere
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
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-foreground/70">
                  Predicție
                </p>
                <TrendingUp
                  className="size-4 shrink-0 text-primary/80"
                  aria-hidden
                />
              </div>
              <ul className="mt-3 space-y-2.5">
                {prediction!.picks!.map((p, i) => {
                  const ro = marketDisplayRo(p);
                  const pickLine = predictionPickLineRo(p);
                  return (
                    <li
                      key={`${p.marketId ?? ro.market}-${i}`}
                      className="text-[13px] text-foreground-secondary"
                    >
                      {pickLine}
                    </li>
                  );
                })}
              </ul>

              <CotaIncredereRow
                combined={combined}
                probPct={probPct}
                reduceMotion={reduceMotion}
                visual="hero"
              />
            </>
          )
        )}
      </section>
      )}

      {!showPredictionLock && progressRowsForStrip.length > 0 ? (
        <ComboProgressStrip rows={progressRowsForStrip} />
      ) : null}

      {showPredictionLock &&
      teaser &&
      !lockedLiveGuest &&
      !guestUpcomingHasPredTeaser ? (
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
