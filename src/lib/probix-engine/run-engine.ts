import { PROBIX_ENGINE_LEAGUE_IDS } from "@/lib/probix-engine/config";
import { loadProbixFixtureContext } from "@/lib/probix-engine/context-loader";
import { generateExplanationBullets } from "@/lib/probix-engine/explanations-ro";
import { buildProbixFeatures } from "@/lib/probix-engine/features";
import { generateMarketCandidates } from "@/lib/probix-engine/market-engine";
import { selectComboAndRisk } from "@/lib/probix-engine/selector-risk";
import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

export async function runProbixEngine(
  fixture: NormalizedFixture,
): Promise<ProbixEngineOutput | null> {
  if (!PROBIX_ENGINE_LEAGUE_IDS.has(fixture.leagueId)) return null;

  const ctx = await loadProbixFixtureContext(fixture);
  if (!ctx) return null;

  const f = buildProbixFeatures(ctx);
  const all = generateMarketCandidates(ctx, f);
  const {
    picks,
    riskRating,
    estimatedCombinedDecimal,
    confidenceScore,
    confidenceAvg,
    engineVersion,
  } = selectComboAndRisk(all, f);

  if (picks.length < 2) return null;

  const explanationBullets = generateExplanationBullets(ctx, f, picks);

  return {
    picks,
    confidenceScore,
    confidenceAvg,
    estimatedCombinedDecimal,
    riskRating,
    explanationBullets,
    engineVersion,
  };
}
