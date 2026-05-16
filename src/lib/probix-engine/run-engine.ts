import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { buildSportmonksPredictionDecision } from "@/lib/probix-engine/sportmonks-selection";
import type {
  ProbixEngineOutput,
  ProbixNoBetResult,
} from "@/lib/probix-engine/types";
import type { ProbixLearningContext } from "@/lib/probix-evolution/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

function engineAllowsLeague(leagueId: number): boolean {
  return TRACKED_LEAGUE_IDS.has(leagueId);
}

export type RunProbixEngineOptions = {
  /** Kept for caller compatibility; SportMonks odds are read from the fixture. */
  oddsByMarketId?: ReadonlyMap<string, number>;
  learning?: ProbixLearningContext | null;
  disableRiskGates?: boolean;
};

export async function runProbixEngine(
  fixture: NormalizedFixture,
  opts?: RunProbixEngineOptions,
): Promise<ProbixEngineOutput | null> {
  if (!engineAllowsLeague(fixture.leagueId)) return null;
  const learn = opts?.learning ?? null;
  if (learn?.hardBlockedLeagueNames.has(fixture.leagueName)) return null;
  const decision = buildSportmonksPredictionDecision(fixture, learn, {
    disableRiskGates: opts?.disableRiskGates,
  });
  return "kind" in decision ? null : decision;
}

export async function runProbixEngineDecision(
  fixture: NormalizedFixture,
  opts?: RunProbixEngineOptions,
): Promise<ProbixEngineOutput | ProbixNoBetResult | null> {
  if (!engineAllowsLeague(fixture.leagueId)) return null;
  const learn = opts?.learning ?? null;
  if (learn?.hardBlockedLeagueNames.has(fixture.leagueName)) {
    return {
      kind: "no_bet",
      reason: "poor_league_history",
      outcome: "NO_BET",
      debug: { comboRejectedReason: "poor_league_history" },
    };
  }
  return buildSportmonksPredictionDecision(fixture, learn, {
    disableRiskGates: opts?.disableRiskGates,
  });
}
