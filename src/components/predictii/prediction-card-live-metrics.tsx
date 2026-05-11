"use client";

import { motion, useReducedMotion } from "framer-motion";
import type {
  FixtureLiveStatsSplit,
  FixtureTeamLiveNumbers,
  NormalizedFixture,
} from "@/lib/football-api/types";

/** Aceeași înălțime / fundal ca bara din hero (`landing-hero-dashboard`). */
const BAR_TRACK = "h-1.5 w-full overflow-hidden rounded-full bg-muted/60";
const BAR_HOME =
  "h-full shrink-0 rounded-l-full bg-gradient-to-r from-primary/80 to-probix-purple/70";
const BAR_AWAY = "h-full shrink-0 rounded-r-full bg-sky-400/25";

type RowSpec = {
  key: keyof FixtureTeamLiveNumbers;
  label: string;
  kind: "count" | "possession";
};

/** Rânduri ascunse dacă API nu trimite deloc câmpul (evităm 0–0 înșelător). */
const COUNT_STATS_REQUIRE_API: (keyof FixtureTeamLiveNumbers)[] = [
  "dangerousAttacks",
  "redCards",
];

/**
 * Ordine fixă — mapare `/fixtures/statistics`.
 * „Ocazii mari” / „Cartonașe roșii” doar dacă există valoare numerică de la API pentru cel puțin o echipă.
 */
const STAT_ROWS: RowSpec[] = [
  { key: "possessionPct", label: "Posesie", kind: "possession" },
  { key: "shotsTotal", label: "Șuturi (total)", kind: "count" },
  { key: "shotsOnGoal", label: "Șuturi pe poartă", kind: "count" },
  { key: "dangerousAttacks", label: "Ocazii mari", kind: "count" },
  { key: "corners", label: "Cornere", kind: "count" },
  { key: "fouls", label: "Faulturi", kind: "count" },
  { key: "yellowCards", label: "Cartonașe galbene", kind: "count" },
  { key: "redCards", label: "Cartonașe roșii", kind: "count" },
];

function numFromSide(v: number | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  return 0;
}

/** Cel puțin o parte are valoare numerică din API (nu lipsă completă a câmpului). */
function hasNumericStatPair(
  s: FixtureLiveStatsSplit,
  key: keyof FixtureTeamLiveNumbers,
): boolean {
  const hv = s.home[key];
  const av = s.away[key];
  return (
    (typeof hv === "number" && Number.isFinite(hv)) ||
    (typeof av === "number" && Number.isFinite(av))
  );
}

function pairNums(
  s: FixtureLiveStatsSplit,
  key: keyof FixtureTeamLiveNumbers,
): { h: number; a: number } {
  return {
    h: numFromSide(s.home[key]),
    a: numFromSide(s.away[key]),
  };
}

function formatCell(n: number, kind: "count" | "possession"): string {
  if (kind === "possession") return `${Math.round(n)}%`;
  return `${Math.round(n)}`;
}

/**
 * Partea stângă a barei (0–100). La total 0 (ambele 0 sau lipsă → 0) folosim 50%
 * ca neutru vizual — bara rămâne mereu plină (inclusiv la trecerea pre-live → live).
 */
function leftSharePct(home: number, away: number): number {
  const t = home + away;
  if (t <= 0) return 50;
  return Math.min(100, Math.max(0, (home / t) * 100));
}

function DualTeamBar({
  home,
  away,
  reduceMotion,
}: {
  home: number;
  away: number;
  reduceMotion: boolean | null;
}) {
  const leftPct = leftSharePct(home, away);
  const rightPct = 100 - leftPct;

  return (
    <div className={`mt-1.5 flex ${BAR_TRACK}`} role="presentation" aria-hidden>
      <motion.div
        className={BAR_HOME}
        initial={reduceMotion ? false : { width: "0%" }}
        animate={{ width: `${leftPct}%` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 38, stiffness: 280 }
        }
      />
      <motion.div
        className={BAR_AWAY}
        initial={reduceMotion ? false : { width: "0%" }}
        animate={{ width: `${rightPct}%` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 38, stiffness: 280, delay: 0.03 }
        }
      />
    </div>
  );
}

type BuiltRow = {
  key: string;
  label: string;
  kind: "count" | "possession";
  h: number;
  a: number;
};

function buildRows(s: FixtureLiveStatsSplit | null): BuiltRow[] {
  return STAT_ROWS.flatMap((spec) => {
    if (
      COUNT_STATS_REQUIRE_API.includes(spec.key) &&
      (!s || !hasNumericStatPair(s, spec.key))
    ) {
      return [];
    }
    const pair = s ? pairNums(s, spec.key) : { h: 0, a: 0 };
    return [
      {
        key: spec.key,
        label: spec.label,
        kind: spec.kind,
        h: pair.h,
        a: pair.a,
      },
    ];
  });
}

/** Statistici live din `liveStatsSplit` — layout tip Flashscore, bare ca în hero landing. */
export function PredictionCardLiveMetrics({
  fixture,
}: {
  fixture: NormalizedFixture;
}) {
  const reduceMotion = useReducedMotion();
  const rows = buildRows(fixture.liveStatsSplit ?? null);

  return (
    <section
      className="rounded-xl border border-border/45 bg-muted/15 px-2.5 py-2.5 sm:px-3 sm:py-3"
      aria-label="Indicatori în meci"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-foreground/72">
        Meci în cifre
      </p>
      <ul className="mt-2.5 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key} className="min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-0.5 sm:gap-x-3">
              <span className="text-left font-mono text-sm font-semibold tabular-nums tracking-tight text-foreground">
                {formatCell(r.h, r.kind)}
              </span>
              <span className="max-w-[11rem] shrink px-1 text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-foreground-muted sm:max-w-[13rem] sm:text-[11px]">
                {r.label}
              </span>
              <span className="text-right font-mono text-sm font-semibold tabular-nums tracking-tight text-foreground">
                {formatCell(r.a, r.kind)}
              </span>
            </div>
            <DualTeamBar home={r.h} away={r.a} reduceMotion={reduceMotion} />
          </li>
        ))}
      </ul>
    </section>
  );
}
