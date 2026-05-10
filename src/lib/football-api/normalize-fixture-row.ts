import { defaultEuropeanSeasonYearFromTrackedDay } from "@/lib/football-api/bucharest-calendar";
import { fixtureBucket } from "@/lib/football-api/bucket";
import { displayLeagueName } from "@/lib/football-api/tracked-leagues";
import type { ApiFixtureRow, NormalizedFixture } from "@/lib/football-api/types";

/** Fallback sezon dacă lipsesc din `/fixtures`: iul-dec → an curent ca start sezon UE. */
function inferSeasonUtc(isoKickoff: string): number | null {
  try {
    const d = new Date(isoKickoff);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    if (Number.isNaN(d.getTime())) return null;
    return m >= 7 ? y : y - 1;
  } catch {
    return null;
  }
}

/** Dacă API nu trimite league.season. */
function seasonFromTrackedDayFallback(): number {
  return defaultEuropeanSeasonYearFromTrackedDay();
}

export function normalizeFixtureRow(row: ApiFixtureRow): NormalizedFixture {
  const short = row.fixture.status.short;
  let season =
    typeof row.league.season === "number" ? row.league.season : null;
  if (season == null) season = inferSeasonUtc(row.fixture.date);
  if (season == null) season = seasonFromTrackedDayFallback();

  const homeTeamId = row.teams.home.id;
  const awayTeamId = row.teams.away.id;

  return {
    id: row.fixture.id,
    leagueId: row.league.id,
    season,
    leagueName: displayLeagueName(row.league.id, row.league.name),
    leagueLogo: row.league.logo ?? null,
    kickoffIso: row.fixture.date,
    timestamp: row.fixture.timestamp,
    statusShort: short,
    statusLong: row.fixture.status.long,
    minute: row.fixture.status.elapsed,
    homeTeamId,
    awayTeamId,
    homeName: row.teams.home.name,
    awayName: row.teams.away.name,
    homeLogo: row.teams.home.logo ?? null,
    awayLogo: row.teams.away.logo ?? null,
    homeGoals: row.goals.home,
    awayGoals: row.goals.away,
    bucket: fixtureBucket(short),
  };
}
