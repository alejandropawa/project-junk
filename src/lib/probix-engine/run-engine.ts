import { PROBIX_ENGINE_LEAGUE_IDS } from "@/lib/probix-engine/config";
import { loadProbixFixtureContext } from "@/lib/probix-engine/context-loader";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { dedupeExclusiveMarketOrder } from "@/lib/probix-engine/market-exclusivity";
import { generateExplanationBullets } from "@/lib/probix-engine/explanations-ro";
import { buildProbixFeatures } from "@/lib/probix-engine/features";
import { generateMarketCandidates } from "@/lib/probix-engine/market-engine";
import { selectComboAndRisk } from "@/lib/probix-engine/selector-risk";
import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

function engineAllowsLeague(leagueId: number): boolean {
  /** Orice ligă afișată în app (TRACKED); subset PROBIX = calibrare prioritară, nu unică sursă. */
  return (
    PROBIX_ENGINE_LEAGUE_IDS.has(leagueId) || TRACKED_LEAGUE_IDS.has(leagueId)
  );
}

export async function runProbixEngine(
  fixture: NormalizedFixture,
): Promise<ProbixEngineOutput | null> {
  if (!engineAllowsLeague(fixture.leagueId)) return null;

  const ctx = await loadProbixFixtureContext(fixture);
  if (!ctx) return null;

  const f = buildProbixFeatures(ctx);
  const all = generateMarketCandidates(ctx, f);
  let selected = selectComboAndRisk(all, f);
  let picks = dedupeExclusiveMarketOrder(selected.picks);

  if (picks.length < 2 && fixture.bucket === "live") {
    selected = selectComboAndRisk(all, f, { mode: "liveRelaxed" });
    picks = dedupeExclusiveMarketOrder(selected.picks);
  }

  if (picks.length < 2) return null;

  const confidenceAvg =
    picks.reduce((s, x) => s + x.confidence, 0) / picks.length;

  let estimatedCombinedDecimal = selected.estimatedCombinedDecimal;
  if (picks.length !== selected.picks.length) {
    const d = picks.reduce((m, x) => m * x.estimatedDecimal, 1);
    estimatedCombinedDecimal = Number(
      Math.min(28, Math.max(1.2, d)).toFixed(2),
    );
  }

  const explanationBullets = generateExplanationBullets(ctx, f, picks);

  return {
    picks,
    confidenceScore: selected.confidenceScore,
    confidenceAvg,
    estimatedCombinedDecimal,
    riskRating: selected.riskRating,
    explanationBullets,
    engineVersion: selected.engineVersion,
  };
}
