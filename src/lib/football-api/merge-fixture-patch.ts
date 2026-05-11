import type {
  FixtureLiveStatsSplit,
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
        liveStatsSplit:
          split !== undefined ? split : p.liveStatsSplit ?? f.liveStatsSplit,
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
      };
    }

    if (f.bucket === "live" && p.bucket === "upcoming") return f;

    const merged: NormalizedFixture = { ...f, ...p };

    if (p.bucket === "live") {
      merged.minute = monotonicMinute(f.minute, p.minute, f.bucket);
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
    }

    return merged;
  });
}
