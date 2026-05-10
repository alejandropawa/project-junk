import { parseFixtureStatisticsBody } from "@/lib/football-api/fixture-live-stats";
import { hasRealFootballApiErrors } from "@/lib/football-api/response-errors";
import {
  parseApiResponse,
  type FixtureLiveStatsSplit,
} from "@/lib/football-api/types";

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

async function fetchStatisticsJson(
  fixtureId: number,
  headers: HeadersInit,
): Promise<unknown | null> {
  const url = new URL("/fixtures/statistics", API_BASE);
  url.searchParams.set("fixture", String(fixtureId));
  try {
    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Statistici meci pentru `liveStatsSplit` (Predicții, polling live); best-effort. */
export async function fetchFixtureLiveStatsSplit(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  headers: HeadersInit,
): Promise<FixtureLiveStatsSplit | null> {
  const statsJson = await fetchStatisticsJson(fixtureId, headers);
  if (!statsJson || typeof statsJson !== "object") return null;

  const statParsed = parseApiResponse(statsJson);
  if (hasRealFootballApiErrors(statParsed.errors)) return null;

  return parseFixtureStatisticsBody(statsJson, homeTeamId, awayTeamId);
}
