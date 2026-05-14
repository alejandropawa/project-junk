import type {
  FixtureLiveStatsSplit,
  FixtureStatisticRow,
  FixtureTeamLiveNumbers,
  NormalizedFixture,
  SportmonksFixtureRow,
  SportmonksOdd,
  SportmonksParticipant,
  SportmonksPrediction,
} from "@/lib/football-api/types";
import { fixtureBucket } from "@/lib/football-api/bucket";
import { fixtureStatisticLabelRo } from "@/lib/football-api/stat-labels";
import { displayLeagueName } from "@/lib/football-api/tracked-leagues";

const FOOTBALL_BASE =
  process.env.SPORTMONKS_API_BASE_URL ?? "https://api.sportmonks.com/v3/football";

const DEFAULT_INCLUDE =
  "league;participants;scores;state;periods;statistics.type;events;predictions.type;odds";

export type SportmonksApiResult<T> =
  | { ok: true; data: T; rateLimitRemaining?: number }
  | { ok: false; error: string; status?: number };

export function sportmonksToken(): string | null {
  const token = process.env.SPORTMONKS_API_TOKEN?.trim();
  return token || null;
}

export function sportmonksUrl(path: string): URL {
  const base = FOOTBALL_BASE.endsWith("/") ? FOOTBALL_BASE : `${FOOTBALL_BASE}/`;
  return new URL(path.replace(/^\/+/, ""), base);
}

export function trackedFixtureInclude(): string {
  return DEFAULT_INCLUDE;
}

export async function sportmonksFetch<T>(
  path: string,
  params?: Record<string, string | number | null | undefined>,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<SportmonksApiResult<T>> {
  const token = sportmonksToken();
  if (!token) {
    return {
      ok: false,
      error:
        "Lipseste SPORTMONKS_API_TOKEN in .env.local. Adauga cheia SportMonks si reincearca.",
    };
  }

  const url = sportmonksUrl(path);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v == null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Eroare retea SportMonks",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: `SportMonks: ${res.status} ${res.statusText}`,
    };
  }

  const json = (await res.json()) as {
    data?: T;
    message?: string;
    rate_limit?: { remaining?: number };
  };
  if (!("data" in json)) {
    return {
      ok: false,
      error: json.message ?? "Raspuns SportMonks invalid",
    };
  }

  return {
    ok: true,
    data: json.data as T,
    rateLimitRemaining: json.rate_limit?.remaining,
  };
}

function participantByLocation(
  participants: readonly SportmonksParticipant[] | undefined,
  location: "home" | "away",
): SportmonksParticipant | null {
  return (
    participants?.find((p) => p.meta?.location === location) ??
    participants?.find((p) => p.meta?.position === (location === "home" ? 1 : 2)) ??
    null
  );
}

function scoreGoals(row: SportmonksFixtureRow, location: "home" | "away"): number | null {
  const candidates = row.scores ?? [];
  for (const score of candidates) {
    const descr = (score.description ?? "").toUpperCase();
    const participant = score.score?.participant;
    if (
      participant === location &&
      (descr.includes("CURRENT") ||
        descr.includes("FULLTIME") ||
        descr.includes("2ND_HALF") ||
        descr === "")
    ) {
      const goals = score.score?.goals;
      return typeof goals === "number" && Number.isFinite(goals) ? goals : null;
    }
  }
  return null;
}

function normalizeMinuteForState(rawMinute: number | null, statusShort: string): number | null {
  if (rawMinute == null) return null;
  const status = statusShort.toUpperCase();
  if (status === "INPLAY_2ND_HALF" || status === "2ND" || status === "2H") {
    return rawMinute < 46 ? rawMinute + 45 : rawMinute;
  }
  if (status === "INPLAY_ET" || status === "ET") {
    return rawMinute < 91 ? rawMinute + 90 : rawMinute;
  }
  if (
    status === "INPLAY_ET_2ND_HALF" ||
    status === "INPLAY_ET_SECOND_HALF" ||
    status === "2ET"
  ) {
    return rawMinute < 106 ? rawMinute + 105 : rawMinute;
  }
  return rawMinute;
}

function currentMinute(row: SportmonksFixtureRow, statusShort: string): number | null {
  const period = [...(row.periods ?? [])]
    .filter((p) => typeof p.minutes === "number")
    .sort((a, b) => (b.started ?? 0) - (a.started ?? 0))[0];
  const raw = typeof period?.minutes === "number" ? period.minutes : null;
  return normalizeMinuteForState(raw, statusShort);
}

function num(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number.parseFloat(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function feedStat(into: FixtureTeamLiveNumbers, typeId: number | null, value: unknown) {
  const n = num(value);
  if (n == null || n < 0) return;
  if (typeId === 34) into.corners = n;
  if (typeId === 42) into.shotsTotal = n;
  if (typeId === 44) into.dangerousAttacks = n;
  if (typeId === 43) into.attacksNormal = n;
  if (typeId === 45) into.possessionPct = Math.min(100, n);
  if (typeId === 56) into.fouls = n;
  if (typeId === 58) into.shotsOnGoal = n;
  if (typeId === 84) into.yellowCards = n;
  if (typeId === 83) into.redCards = n;
}

function statLabel(typeId: number, apiName?: string | null, developerName?: string | null) {
  return fixtureStatisticLabelRo(typeId, apiName, developerName);
}

export function liveStatsFromSportmonksRow(row: SportmonksFixtureRow): FixtureLiveStatsSplit | null {
  const home = participantByLocation(row.participants, "home");
  const away = participantByLocation(row.participants, "away");
  const out: FixtureLiveStatsSplit = { home: {}, away: {} };
  for (const s of row.statistics ?? []) {
    const participantId = typeof s.participant_id === "number" ? s.participant_id : null;
    const target =
      participantId === home?.id ? out.home : participantId === away?.id ? out.away : null;
    if (!target) continue;
    feedStat(target, typeof s.type_id === "number" ? s.type_id : null, s.data?.value);
  }
  return Object.keys(out.home).length || Object.keys(out.away).length ? out : null;
}

export function liveStatisticRowsFromSportmonksRow(row: SportmonksFixtureRow): FixtureStatisticRow[] {
  const home = participantByLocation(row.participants, "home");
  const away = participantByLocation(row.participants, "away");
  const byType = new Map<number, FixtureStatisticRow>();

  for (const s of row.statistics ?? []) {
    const typeId = typeof s.type_id === "number" ? s.type_id : null;
    if (typeId == null) continue;
    const value = num(s.data?.value);
    if (value == null) continue;

    const participantId = typeof s.participant_id === "number" ? s.participant_id : null;
    const side =
      participantId === home?.id ? "home" : participantId === away?.id ? "away" : null;
    if (!side) continue;

    const cur =
      byType.get(typeId) ??
      {
        typeId,
        label: statLabel(typeId, s.type?.name, s.type?.developer_name),
        home: null,
        away: null,
      };
    cur[side] = value;
    byType.set(typeId, cur);
  }

  return [...byType.values()].sort((a, b) => a.typeId - b.typeId);
}

export function normalizeSportmonksFixtureRow(row: SportmonksFixtureRow): NormalizedFixture {
  const home = participantByLocation(row.participants, "home");
  const away = participantByLocation(row.participants, "away");
  const stateShort =
    row.state?.developer_name ?? row.state?.state ?? row.state?.short_name ?? "NS";
  const kickoffIso = new Date(row.starting_at_timestamp * 1000).toISOString();

  return {
    id: row.id,
    leagueId: row.league_id,
    season: row.season_id,
    leagueName: displayLeagueName(row.league_id, row.league?.name ?? `Liga ${row.league_id}`),
    leagueLogo: row.league?.image_path ?? null,
    kickoffIso,
    timestamp: row.starting_at_timestamp,
    statusShort: stateShort,
    statusLong: row.state?.name ?? stateShort,
    minute: currentMinute(row, stateShort),
    homeTeamId: home?.id ?? 0,
    awayTeamId: away?.id ?? 0,
    homeName: home?.name ?? "Gazde",
    awayName: away?.name ?? "Oaspeti",
    homeLogo: home?.image_path ?? null,
    awayLogo: away?.image_path ?? null,
    homeGoals: scoreGoals(row, "home"),
    awayGoals: scoreGoals(row, "away"),
    bucket: fixtureBucket(stateShort),
    liveStatsSplit: liveStatsFromSportmonksRow(row) ?? undefined,
    liveStatistics: liveStatisticRowsFromSportmonksRow(row),
    sportmonksPredictions: row.predictions ?? [],
    sportmonksOdds: row.odds ?? [],
  };
}

export function filterBookmakers(odds: readonly SportmonksOdd[]): SportmonksOdd[] {
  const raw = process.env.SPORTMONKS_BOOKMAKER_IDS?.trim();
  if (!raw) return [...odds];
  const allowed = new Set(
    raw
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x)),
  );
  if (!allowed.size) return [...odds];
  return odds.filter((o) => allowed.has(o.bookmaker_id));
}

export function isSportmonksPredictionArray(value: unknown): value is SportmonksPrediction[] {
  return Array.isArray(value);
}
