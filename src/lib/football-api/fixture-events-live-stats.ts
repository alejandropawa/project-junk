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

/**
 * Unește `/fixtures/statistics` cu totaluri derivate din evenimente (când există).
 * Pentru contori monotoni (cornere, cartonașe, faulturi), folosește **max(stat, events)**:
 * uneori `/statistics` sub-reprezintă față de feed-ul de evenimente; invers, evenimentele pot lipsi.
 */
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

  /** Câmpuri unde două surse independente pot diferi — preferăm valoarea mai mare (nu sub-evaluează). */
  const MAX_IF_BOTH: Partial<Record<keyof FixtureTeamLiveNumbers, true>> = {
    corners: true,
    yellowCards: true,
    redCards: true,
    fouls: true,
  };

  const mergeSide = (role: "home" | "away"): FixtureTeamLiveNumbers => {
    const ev = fromEvents?.[role] ?? {};
    const st = fromStatistics?.[role] ?? {};
    const out: FixtureTeamLiveNumbers = {};
    for (const k of KEYS) {
      const a = st[k];
      const b = ev[k];
      const na =
        typeof a === "number" && Number.isFinite(a) ? (a as number) : null;
      const nb =
        typeof b === "number" && Number.isFinite(b) ? (b as number) : null;

      let chosen: number | undefined;
      if (MAX_IF_BOTH[k] && na != null && nb != null) {
        chosen = Math.max(na, nb);
      } else if (na != null) {
        chosen = na;
      } else if (nb != null) {
        chosen = nb;
      }

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
