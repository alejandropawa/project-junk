import type {
  FixtureLiveStatsSplit,
  FixtureTeamLiveNumbers,
} from "@/lib/football-api/types";

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

/** Minimal shape din `/fixtures` sau `/fixtures/events` (API-Football). */
export type FixtureEventLike = {
  team?: { id?: unknown };
  type?: string | null;
  detail?: string | null;
};

function teamId(ev: FixtureEventLike): number | null {
  const tid = ev.team?.id;
  const n =
    typeof tid === "number" ? tid : tid != null ? Number(tid) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Unele ligii (ex. Liga II) nu au `/fixtures/statistics` populate în timpul meciului;
 * feed-ul de evenimente conține totuși goluri, cartonașe, înlocuiri și uneori cornere.
 */
export function deriveLiveStatsSplitFromEvents(
  events: unknown[] | null | undefined,
  homeTeamId: number,
  awayTeamId: number,
): FixtureLiveStatsSplit | null {
  if (!events?.length) return null;

  const home: FixtureTeamLiveNumbers = {};
  const away: FixtureTeamLiveNumbers = {};

  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const ev = raw as FixtureEventLike;
    const tid = teamId(ev);
    if (tid !== homeTeamId && tid !== awayTeamId) continue;

    const into = tid === homeTeamId ? home : away;
    const type = (ev.type ?? "").toLowerCase().trim();
    const detail = (ev.detail ?? "").toLowerCase().trim();

    if (type === "card") {
      if (detail.includes("yellow")) {
        into.yellowCards = (into.yellowCards ?? 0) + 1;
      } else if (detail.includes("red")) {
        into.redCards = (into.redCards ?? 0) + 1;
      }
      continue;
    }

    /** Unele fluxuri livetable marchează cornere explicit. */
    if (
      type === "corner" ||
      detail.includes("corner kick") ||
      detail.includes("corner")
    ) {
      into.corners = (into.corners ?? 0) + 1;
    }
  }

  const hasNumbers = (ns: FixtureTeamLiveNumbers) =>
    Object.keys(ns).length > 0;

  if (!hasNumbers(home) && !hasNumbers(away)) return null;
  return { home, away };
}

/** Preferă valorile din `/fixtures/statistics`; events completează câmpuri lipsă. */
export function mergeLiveStatsSplits(
  fromStatistics: FixtureLiveStatsSplit | null | undefined,
  fromEvents: FixtureLiveStatsSplit | null | undefined,
): FixtureLiveStatsSplit | null {
  if (!fromStatistics && !fromEvents) return null;

  const KEYS: (keyof FixtureTeamLiveNumbers)[] = [
    "shotsOnGoal",
    "shotsTotal",
    "corners",
    "fouls",
    "dangerousAttacks",
    "attacksNormal",
    "possessionPct",
    "yellowCards",
    "redCards",
  ];

  const mergeSide = (role: "home" | "away"): FixtureTeamLiveNumbers => {
    const ev = fromEvents?.[role] ?? {};
    const st = fromStatistics?.[role] ?? {};
    const out: FixtureTeamLiveNumbers = {};
    for (const k of KEYS) {
      const a = st[k];
      const b = ev[k];
      const chosen =
        typeof a === "number" && Number.isFinite(a)
          ? a
          : typeof b === "number" && Number.isFinite(b)
            ? b
            : undefined;
      if (chosen !== undefined) Object.assign(out, { [k]: chosen });
    }
    return out;
  };

  const home = mergeSide("home");
  const away = mergeSide("away");
  const ok = Object.keys(home).length + Object.keys(away).length > 0;

  return ok ? { home, away } : null;
}

/** Corp `/fixtures/events?fixture=id` — folosit în SSR dacă statisticile sunt goale. */
export async function fetchFixtureEventsPayload(
  fixtureId: number,
  headers: HeadersInit,
): Promise<unknown[]> {
  const url = new URL("/fixtures/events", API_BASE);
  url.searchParams.set("fixture", String(fixtureId));
  try {
    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { response?: unknown };
    const r = json.response;
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
