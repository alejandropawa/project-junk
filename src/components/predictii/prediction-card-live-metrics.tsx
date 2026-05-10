"use client";

import { motion, useReducedMotion } from "framer-motion";
import type {
  FixtureLiveStatsSplit,
  FixtureTeamLiveNumbers,
  NormalizedFixture,
} from "@/lib/football-api/types";

function formatPairDisplay(
  home: number | null,
  away: number | null,
): string {
  if (home == null && away == null) return "- · -";
  return `${home ?? "-"} · ${away ?? "-"}`;
}

function formatPossessionDisplay(
  home: number | null,
  away: number | null,
): string {
  if (home == null && away == null) return "- · -";
  const h = home != null ? `${Math.round(home)}%` : "-";
  const a = away != null ? `${Math.round(away)}%` : "-";
  return `${h} · ${a}`;
}

function ThinBar({
  home,
  away,
  reduceMotion,
}: {
  home: number;
  away: number;
  reduceMotion: boolean | null;
}) {
  const tot = Math.max(1e-9, home + away);
  const leftPct = (home / tot) * 100;
  return (
    <div
      className="flex h-[2px] w-full overflow-hidden rounded-full bg-border/40"
      role="presentation"
    >
      <motion.div
        className="rounded-full bg-primary/42"
        initial={reduceMotion ? false : { width: "0%" }}
        animate={{ width: `${Math.min(100, Math.max(0, leftPct))}%` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 44, stiffness: 300 }
        }
      />
      <div
        className="h-full min-w-0 flex-1 rounded-full bg-sky-400/22"
        aria-hidden
      />
    </div>
  );
}

type RowSpec = {
  key: keyof FixtureLiveStatsSplit["home"];
  label: string;
  kind: "count" | "possession";
};

/** Ordinea dorită; includem un rând doar dacă API-ul trimite cel puțin o valoare. */
const API_STAT_ROWS: RowSpec[] = [
  { key: "shotsOnGoal", label: "Șuturi pe poartă", kind: "count" },
  { key: "shotsTotal", label: "Șuturi (total)", kind: "count" },
  { key: "corners", label: "Cornere", kind: "count" },
  { key: "fouls", label: "Faulturi", kind: "count" },
  { key: "possessionPct", label: "Posesie", kind: "possession" },
  { key: "dangerousAttacks", label: "Atacuri periculoase", kind: "count" },
  { key: "attacksNormal", label: "Atacuri", kind: "count" },
  { key: "yellowCards", label: "Cartonașe galbene", kind: "count" },
  { key: "redCards", label: "Cartonașe roșii", kind: "count" },
];

function pickPair(
  s: FixtureLiveStatsSplit,
  key: keyof FixtureTeamLiveNumbers,
): { h: number | null; a: number | null } | null {
  const av = s.away[key];
  const hv = s.home[key];
  const h = typeof hv === "number" && Number.isFinite(hv) ? Math.max(0, hv) : null;
  const a = typeof av === "number" && Number.isFinite(av) ? Math.max(0, av) : null;
  if (h == null && a == null) return null;
  return { h, a };
}

function buildRowsFromApi(s: FixtureLiveStatsSplit): {
  key: string;
  label: string;
  disp: string;
  barHome: number;
  barAway: number;
  showBar: boolean;
}[] {
  const out: ReturnType<typeof buildRowsFromApi> = [];
  for (const spec of API_STAT_ROWS) {
    const pair = pickPair(s, spec.key);
    if (!pair) continue;
    const disp =
      spec.kind === "possession"
        ? formatPossessionDisplay(pair.h, pair.a)
        : formatPairDisplay(pair.h, pair.a);
    const barHome = pair.h ?? 0;
    const barAway = pair.a ?? 0;
    const showBar =
      spec.kind === "possession"
        ? pair.h != null && pair.a != null
        : pair.h != null && pair.a != null;
    out.push({
      key: spec.key,
      label: spec.label,
      disp,
      barHome: Math.max(barHome, 1e-9),
      barAway: Math.max(barAway, 1e-9),
      showBar,
    });
  }
  return out;
}

/** Toate statisticile primite din `/fixtures/statistics` (mapate în `liveStatsSplit`) + goluri. */
export function PredictionCardLiveMetrics({
  fixture,
}: {
  fixture: NormalizedFixture;
}) {
  const reduceMotion = useReducedMotion();
  if (fixture.bucket === "upcoming") return null;

  const s = fixture.liveStatsSplit;

  const gh =
    fixture.homeGoals != null && Number.isFinite(fixture.homeGoals)
      ? Math.max(0, fixture.homeGoals)
      : null;
  const ga =
    fixture.awayGoals != null && Number.isFinite(fixture.awayGoals)
      ? Math.max(0, fixture.awayGoals)
      : null;

  const rows: {
    key: string;
    label: string;
    disp: string;
    barHome: number;
    barAway: number;
    showBar: boolean;
  }[] = [
    {
      key: "goals",
      label: "Goluri",
      disp: formatPairDisplay(gh, ga),
      barHome: gh ?? 1,
      barAway: ga ?? 1,
      showBar: gh != null && ga != null,
    },
  ];

  if (s) {
    rows.push(...buildRowsFromApi(s));
  }

  return (
    <section
      className="rounded-xl border border-border/45 bg-[rgba(255,255,255,0.018)] px-2.5 py-2 sm:px-3 sm:py-2.5"
      aria-label="Indicatori în meci"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted/85">
        Meci în cifre
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="min-w-0 space-y-1">
            <div className="flex items-baseline justify-between gap-3 tabular-nums">
              <span className="shrink-0 text-[13px] font-medium tracking-tight text-foreground-secondary">
                {r.label}
              </span>
              <span className="min-w-0 truncate text-right text-[13px] font-medium tabular-nums tracking-tight text-foreground-muted">
                {r.disp}
              </span>
            </div>
            {r.showBar ? (
              <ThinBar
                home={r.barHome}
                away={r.barAway}
                reduceMotion={reduceMotion}
              />
            ) : (
              <div className="h-[2px] w-full rounded-full bg-border/30" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
