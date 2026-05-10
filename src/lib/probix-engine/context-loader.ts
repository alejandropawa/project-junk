import { apiFootballFetch } from "@/lib/probix-engine/api-football";
import {
  deriveProfileFromIncomplete,
  parseTeamStatistics,
  unpackStatsBody,
} from "@/lib/probix-engine/statistics-parser";
import type {
  H2HSummary,
  ProbixEngineInput,
  TeamProfile,
} from "@/lib/probix-engine/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

async function fetchTeamProfile(
  teamId: number,
  leagueId: number,
  season: number,
): Promise<TeamProfile> {
  const { ok, json } = await apiFootballFetch("/teams/statistics", {
    team: teamId,
    league: leagueId,
    season,
  });

  const body = ok ? unpackStatsBody(json) : null;

  if (body && Object.keys(body).length > 0) {
    return parseTeamStatistics(teamId, body);
  }

  return deriveProfileFromIncomplete(teamId, {});
}

async function fetchH2H(
  teamAId: number,
  teamBId: number,
  last = 10,
): Promise<H2HSummary> {
  let { ok, json } = await apiFootballFetch("/fixtures/headtohead", {
    h2h: `${teamAId}-${teamBId}`,
    last,
  });
  if (!ok || !json) {
    ({ ok, json } = await apiFootballFetch("/fixtures", {
      h2h: `${teamAId}-${teamBId}`,
      last,
    }));
  }

  let samples = 0;
  let tg = 0;

  if (
    ok &&
    json &&
    typeof json === "object" &&
    Array.isArray((json as Record<string, unknown>).response)
  ) {
    const rows = (json as { response: unknown[] }).response;
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      const goals = row.goals as
        | { home?: unknown; away?: unknown }
        | undefined;

      const fh = goals?.home;
      const fa = goals?.away;
      const hh = typeof fh === "number" ? fh : Number(fh);
      const aa = typeof fa === "number" ? fa : Number(fa);
      if (!Number.isFinite(hh) || !Number.isFinite(aa)) continue;
      tg += hh + aa;
      samples += 1;
    }
  }

  const avgTotalGoals =
    samples > 0 ? Number((tg / samples).toFixed(2)) : null;
  return {
    samples,
    avgTotalGoals,
    homeWinPct: null,
    drawPct: null,
    awayWinPct: null,
  };
}

export async function loadProbixFixtureContext(
  fixture: NormalizedFixture,
): Promise<ProbixEngineInput | null> {
  if (
    !fixture.homeTeamId ||
    !fixture.awayTeamId ||
    fixture.homeTeamId < 10 ||
    fixture.awayTeamId < 10
  ) {
    return null;
  }

  const [homeP, awayP, h2h] = await Promise.all([
    fetchTeamProfile(
      fixture.homeTeamId,
      fixture.leagueId,
      fixture.season,
    ),
    fetchTeamProfile(
      fixture.awayTeamId,
      fixture.leagueId,
      fixture.season,
    ),
    fetchH2H(fixture.homeTeamId, fixture.awayTeamId, 12),
  ]);

  return { fixture, home: homeP, away: awayP, h2h };
}
