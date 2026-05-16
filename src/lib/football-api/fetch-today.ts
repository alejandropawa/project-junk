import { getBucharestDateString } from "@/lib/football-api/bucharest-calendar";
import {
  normalizeSportmonksFixtureRow,
  sportmonksFetch,
  trackedFixtureInclude,
  trackedFixtureUiInclude,
} from "@/lib/football-api/sportmonks";
import {
  TRACKED_LEAGUES,
  trackedLeagueDisplayName,
} from "@/lib/football-api/tracked-leagues";
import type {
  SportmonksFixtureRow,
  TodayFixturesResult,
  TrackedLeagueStatus,
} from "@/lib/football-api/types";

const TIMEZONE = "Europe/Bucharest";

export { getBucharestDateString };

function leagueStatuses(fixtures: SportmonksFixtureRow[]): TrackedLeagueStatus[] {
  return TRACKED_LEAGUES.map((league) => {
    const rows = fixtures.filter((f) => f.league_id === league.id);
    return {
      id: league.id,
      displayName: trackedLeagueDisplayName(league.id),
      logo: rows[0]?.league?.image_path ?? null,
      gamesToday: rows.length,
    };
  });
}

async function fetchTodayTrackedFixturesRaw(
  cache: RequestCache,
  revalidate?: number,
  include = trackedFixtureInclude(),
): Promise<TodayFixturesResult> {
  const date = getBucharestDateString();
  const filters = `fixtureLeagues:${TRACKED_LEAGUES.map((l) => l.id).join(",")};markets:1,2,14,80,86`;
  const result = await sportmonksFetch<SportmonksFixtureRow[]>(
    `/fixtures/date/${date}`,
    {
      include,
      filters,
      per_page: 50,
      timezone: TIMEZONE,
    },
    revalidate != null
      ? { next: { revalidate } }
      : { cache },
  );

  if (!result.ok) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: result.error,
      fixtures: [],
      leagues: leagueStatuses([]),
    };
  }

  const rows = [...result.data].sort(
    (a, b) => a.starting_at_timestamp - b.starting_at_timestamp,
  );
  return {
    ok: true,
    date,
    timezone: TIMEZONE,
    fixtures: rows.map(normalizeSportmonksFixtureRow),
    leagues: leagueStatuses(rows),
  };
}

/** Pentru cron / predicții: meciuri reale fara cache React. */
export async function fetchTodayTrackedFixturesFresh(): Promise<TodayFixturesResult> {
  return fetchTodayTrackedFixturesRaw("no-store");
}

export async function fetchTodayTrackedFixturesUiFresh(): Promise<TodayFixturesResult> {
  return fetchTodayTrackedFixturesRaw("no-store", undefined, trackedFixtureUiInclude());
}

/**
 * Pages can stay cached for a short period when no match is close to live.
 * Cron and client live polling still use no-store for near-real-time updates.
 */
export async function fetchTodayTrackedFixtures(): Promise<TodayFixturesResult> {
  return fetchTodayTrackedFixturesRaw("force-cache", 15 * 60, trackedFixtureUiInclude());
}

export async function fetchTodayTrackedFixturesForUi(): Promise<TodayFixturesResult> {
  if (process.env.NODE_ENV === "development") {
    return fetchTodayTrackedFixturesUiFresh();
  }
  return fetchTodayTrackedFixtures();
}
