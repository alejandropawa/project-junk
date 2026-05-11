/**
 * Parsing pentru `/fixtures/statistics` - API‑Football (chei descriptive în EN).
 */
import type {
  FixtureLiveStatsSplit,
  FixtureTeamLiveNumbers,
  NormalizedFixture,
} from "@/lib/football-api/types";

function extractNum(raw: unknown): number | null {
  if (raw == null || raw === false) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.replace("%", "").replace(",", ".").trim();
  if (s === "" || s === "-") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function matchType(lower: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => lower.includes(p));
}

function feedNumber(
  into: FixtureTeamLiveNumbers,
  lower: string,
  value: unknown,
): void {
  const n = extractNum(value);
  if (n == null || n < 0) return;

  if (matchType(lower, ["corner kick", "corners"])) {
    into.corners = n;
    return;
  }
  if (
    matchType(lower, ["shots on goal", "shot on target", "attempts on target"])
  ) {
    into.shotsOnGoal = n;
    return;
  }
  if (
    lower.includes("total shots") ||
    /^shots$/i.test(lower.trim()) ||
    lower.startsWith("total shot")
  ) {
    into.shotsTotal = n;
    return;
  }
  if (matchType(lower, ["foul", "fault"])) {
    into.fouls = n;
    return;
  }
  if (
    matchType(lower, [
      "dangerous attack",
      "dangerous attacks",
      "attack dangerous",
      "attacks dangerous",
    ]) ||
    lower.replace(/[\s_-]/g, "").includes("dangerousattack")
  ) {
    into.dangerousAttacks = n;
    return;
  }
  if (
    lower === "attacks" ||
    (lower.includes("attack") &&
      !lower.includes("danger") &&
      !lower.includes("dangerous"))
  ) {
    into.attacksNormal = n;
    return;
  }
  if (matchType(lower, ["ball possession"])) {
    into.possessionPct = Math.min(100, n);
    return;
  }
  if (matchType(lower, ["yellow card"])) {
    into.yellowCards = n;
    return;
  }
  if (
    matchType(lower, ["red card", "red cards"]) ||
    /\bred\s+cards?\b/i.test(lower)
  ) {
    into.redCards = n;
    return;
  }
}

/** Parse corp JSON `/fixtures/statistics`. */
export function parseFixtureStatisticsBody(
  json: unknown,
  homeTeamId: number,
  awayTeamId: number,
): FixtureLiveStatsSplit | null {
  if (!json || typeof json !== "object") return null;
  const res = (json as Record<string, unknown>).response;
  if (!Array.isArray(res)) return null;

  const blank = (): FixtureTeamLiveNumbers => ({});

  const homeNums = blank();
  const awayNums = blank();

  for (const block of res) {
    if (!block || typeof block !== "object") continue;
    const tid = (block as { team?: { id?: unknown } }).team?.id;
    const teamId =
      typeof tid === "number" && Number.isFinite(tid) ? tid : extractNum(tid);
    if (teamId == null) continue;
    const stats = (block as { statistics?: unknown }).statistics;
    if (!Array.isArray(stats)) continue;

    const target =
      teamId === homeTeamId
        ? homeNums
        : teamId === awayTeamId
          ? awayNums
          : null;
    if (!target) continue;

    for (const row of stats) {
      if (!row || typeof row !== "object") continue;
      const r = row as { type?: unknown; value?: unknown };
      const t = typeof r.type === "string" ? r.type.toLowerCase() : "";
      if (!t) continue;
      feedNumber(target, t, r.value);
    }
  }

  if (
    !Object.keys(homeNums).length &&
    !Object.keys(awayNums).length
  ) {
    return null;
  }

  return { home: homeNums, away: awayNums };
}

export function totalsForPredictions(split: FixtureLiveStatsSplit): {
  cornersTotal: number | null;
  /** Galbene + roșii pentru piețe combo cartonașe. */
  cardsTotal: number | null;
  foulsTotal: number | null;
} {
  const hc = split.home.corners;
  const ac = split.away.corners;
  const cornersTotal =
    hc != null || ac != null ? (hc ?? 0) + (ac ?? 0) : null;

  const cardsTotal =
    split.home.yellowCards != null ||
    split.home.redCards != null ||
    split.away.yellowCards != null ||
    split.away.redCards != null
      ? (split.home.yellowCards ?? 0) +
        (split.away.yellowCards ?? 0) +
        (split.home.redCards ?? 0) +
        (split.away.redCards ?? 0)
      : null;

  const hf = split.home.fouls;
  const af = split.away.fouls;
  const foulsTotal =
    hf != null || af != null ? (hf ?? 0) + (af ?? 0) : null;

  return { cornersTotal, cardsTotal, foulsTotal };
}

export function liveTotalsFromFixture(
  f: NormalizedFixture,
): {
  cornersTotal: number | null;
  cardsTotal: number | null;
  foulsTotal: number | null;
} {
  if (!f.liveStatsSplit) {
    return { cornersTotal: null, cardsTotal: null, foulsTotal: null };
  }
  return totalsForPredictions(f.liveStatsSplit);
}
