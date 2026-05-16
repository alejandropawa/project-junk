import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { buildSportmonksPredictionOutput } from "@/lib/probix-engine/sportmonks-selection";
import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import type { ProbixLearningContext } from "@/lib/probix-evolution/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

function engineAllowsLeague(leagueId: number): boolean {
  return TRACKED_LEAGUE_IDS.has(leagueId);
}

export type RunProbixEngineOptions = {
  /** Kept for caller compatibility; SportMonks odds are read from the fixture. */
  oddsByMarketId?: ReadonlyMap<string, number>;
  learning?: ProbixLearningContext | null;
};

export async function runProbixEngine(
  fixture: NormalizedFixture,
  opts?: RunProbixEngineOptions,
): Promise<ProbixEngineOutput | null> {
  if (!engineAllowsLeague(fixture.leagueId)) return null;
  const learn = opts?.learning ?? null;
  if (learn?.hardBlockedLeagueNames.has(fixture.leagueName)) return null;
  return buildSportmonksPredictionOutput(fixture, learn);
}
