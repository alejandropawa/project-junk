import type {
  FixtureLiveStatsSplit,
  FixtureStatisticRow,
  FixtureTeamLiveNumbers,
  NormalizedFixture,
} from "@/lib/football-api/types";

/** Înlocuiește meciurile cu același `id` cu patch‑urile (polling live). */

const COUNT_STAT_KEYS: (keyof FixtureTeamLiveNumbers)[] = [
  "shotsOnGoal",
  "shotsTotal",
  "corners",
  "fouls",
  "dangerousAttacks",
  "attacksNormal",
  "yellowCards",
  "redCards",
];

function mergeTeamLiveNumbersMonotonic(
  prev: FixtureTeamLiveNumbers,
  next: FixtureTeamLiveNumbers,
): FixtureTeamLiveNumbers {
  const out: FixtureTeamLiveNumbers = { ...prev };
  for (const k of COUNT_STAT_KEYS) {
    const a = prev[k];
    const b = next[k];
    const na =
      typeof a === "number" && Number.isFinite(a) ? a : null;
    const nb =
      typeof b === "number" && Number.isFinite(b) ? b : null;
    if (na != null && nb != null) out[k] = Math.max(na, nb);
    else if (nb != null) out[k] = nb;
    else if (na != null) out[k] = na;
    else delete out[k];
  }
  const pp = prev.possessionPct;
  const pn = next.possessionPct;
  if (typeof pn === "number" && Number.isFinite(pn)) {
    out.possessionPct = pn;
  } else if (typeof pp === "number" && Number.isFinite(pp)) {
    out.possessionPct = pp;
  } else if (pn === undefined && pp !== undefined) {
    out.possessionPct = pp;
  }
  return out;
}

function mergeLiveStatsSplitMonotonic(
  prev: FixtureLiveStatsSplit | undefined,
  next: FixtureLiveStatsSplit | undefined,
): FixtureLiveStatsSplit | undefined {
  if (!prev) return next;
  if (!next) return prev;
  return {
    home: mergeTeamLiveNumbersMonotonic(prev.home, next.home),
    away: mergeTeamLiveNumbersMonotonic(prev.away, next.away),
  };
}

/** Minut și scor stabile între polling-uri dacă API returnează valori întârziate. */
function finiteNum(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mergeStatValue(
  prev: number | null | undefined,
  next: number | null | undefined,
  isPossession: boolean,
): number | null {
  const a = finiteNum(prev);
  const b = finiteNum(next);
  if (isPossession) return b ?? a;
  if (a != null && b != null) return Math.max(a, b);
  return b ?? a;
}

function mergeLiveStatisticRowsMonotonic(
  prev: FixtureStatisticRow[] | undefined,
  next: FixtureStatisticRow[] | undefined,
): FixtureStatisticRow[] | undefined {
  if (!prev?.length) return next;
  if (!next?.length) return prev;

  const byType = new Map<number, FixtureStatisticRow>();
  for (const row of prev) byType.set(row.typeId, row);

  for (const row of next) {
    const old = byType.get(row.typeId);
    if (!old) {
      byType.set(row.typeId, row);
      continue;
    }

    const isPossession = row.typeId === 45;
    byType.set(row.typeId, {
      typeId: row.typeId,
      label: row.label || old.label,
      home: mergeStatValue(old.home, row.home, isPossession),
      away: mergeStatValue(old.away, row.away, isPossession),
    });
  }

  return [...byType.values()].sort((a, b) => a.typeId - b.typeId);
}

function monotonicMinute(
  prevMinute: number | null,
  nextMinute: number | null,
  prevBucket: NormalizedFixture["bucket"],
): number | null {
  if (nextMinute == null) return prevMinute;
  if (prevBucket !== "live" || prevMinute == null) return nextMinute;
  return Math.max(prevMinute, nextMinute);
}

function monotonicGoals(
  prevGoals: number | null,
  nextGoals: number | null,
  prevWasLive: boolean,
): number | null {
  if (nextGoals == null) return prevGoals;
  if (!prevWasLive || prevGoals == null) return nextGoals;
  return Math.max(prevGoals, nextGoals);
}

export function mergeFixturePatch(
  prev: NormalizedFixture[],
  patches: NormalizedFixture[],
): NormalizedFixture[] {
  const m = new Map(patches.map((p) => [p.id, p]));
  return prev.map((f) => {
    const p = m.get(f.id);
    if (!p) return f;

    /** API revine la „live” din eroare — păstrăm finalul deja afișat. */
    if (f.bucket === "finished" && p.bucket !== "finished") return f;

    /** Două snapshot-uri FT: actualizăm scorul oficial și statisticile (uneori complete târziu). */
    if (f.bucket === "finished" && p.bucket === "finished") {
      const split = mergeLiveStatsSplitMonotonic(
        f.liveStatsSplit,
        p.liveStatsSplit,
      );
      return {
        ...f,
        ...p,
        homeGoals: p.homeGoals ?? f.homeGoals,
        awayGoals: p.awayGoals ?? f.awayGoals,
        minute: p.minute ?? f.minute,
        addedTime: p.addedTime ?? f.addedTime,
        liveStatsSplit:
          split !== undefined ? split : p.liveStatsSplit ?? f.liveStatsSplit,
        liveStatistics: mergeLiveStatisticRowsMonotonic(
          f.liveStatistics,
          p.liveStatistics,
        ),
      };
    }

    if (p.bucket === "finished") {
      const split = mergeLiveStatsSplitMonotonic(
        f.liveStatsSplit,
        p.liveStatsSplit,
      );
      return {
        ...f,
        ...p,
        homeGoals: monotonicGoals(
          f.homeGoals,
          p.homeGoals,
          f.bucket === "live",
        ),
        awayGoals: monotonicGoals(
          f.awayGoals,
          p.awayGoals,
          f.bucket === "live",
        ),
        liveStatsSplit:
          split !== undefined ? split : p.liveStatsSplit ?? f.liveStatsSplit,
        liveStatistics: mergeLiveStatisticRowsMonotonic(
          f.liveStatistics,
          p.liveStatistics,
        ),
      };
    }

    if (f.bucket === "live" && p.bucket === "upcoming") return f;

    const merged: NormalizedFixture = { ...f, ...p };

    if (p.bucket === "live") {
      merged.minute = monotonicMinute(f.minute, p.minute, f.bucket);
      merged.addedTime = p.addedTime ?? f.addedTime;
      merged.homeGoals = monotonicGoals(
        f.homeGoals,
        p.homeGoals,
        f.bucket === "live",
      );
      merged.awayGoals = monotonicGoals(
        f.awayGoals,
        p.awayGoals,
        f.bucket === "live",
      );
      if (f.bucket === "live") {
        const split = mergeLiveStatsSplitMonotonic(
          f.liveStatsSplit,
          p.liveStatsSplit,
        );
        merged.liveStatsSplit =
          split !== undefined ? split : p.liveStatsSplit ?? f.liveStatsSplit;
      } else {
        merged.liveStatsSplit =
          p.liveStatsSplit !== undefined ? p.liveStatsSplit : f.liveStatsSplit;
      }
      merged.liveStatistics = mergeLiveStatisticRowsMonotonic(
        f.liveStatistics,
        p.liveStatistics,
      );
    }

    return merged;
  });
}
