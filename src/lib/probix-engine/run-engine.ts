import {
  BOOK_ODDS_MAX,
  BOOK_ODDS_MIN,
  PROBIX_ENGINE_LEAGUE_IDS,
} from "@/lib/probix-engine/config";
import { loadProbixFixtureContext } from "@/lib/probix-engine/context-loader";
import { enrichCandidatesWithBookmakerDecimals } from "@/lib/probix-engine/enrich-candidates-odds";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { dedupeExclusiveMarketOrder } from "@/lib/probix-engine/market-exclusivity";
import { generateExplanationBullets } from "@/lib/probix-engine/explanations-ro";
import { buildProbixFeatures } from "@/lib/probix-engine/features";
import { generateMarketCandidates } from "@/lib/probix-engine/market-engine";
import { filterCandidatesForSelectionPolicy } from "@/lib/probix-engine/selection-market-policy";
import {
  defaultSelectionProbabilityContext,
  selectComboAndRisk,
  type SelectionProbabilityContext,
} from "@/lib/probix-engine/selector-risk";
import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import type { ProbixLearningContext } from "@/lib/probix-evolution/types";
import {
  resolveSelectionModeName,
  resolveSelectionWeightBundle,
} from "@/lib/probix-evolution/selection-profile";
import type { NormalizedFixture } from "@/lib/football-api/types";

function engineAllowsLeague(leagueId: number): boolean {
  return (
    PROBIX_ENGINE_LEAGUE_IDS.has(leagueId) || TRACKED_LEAGUE_IDS.has(leagueId)
  );
}

export type RunProbixEngineOptions = {
  oddsByMarketId?: ReadonlyMap<string, number>;
  /** Din `loadProbixLearningContext` când `PROBIX_LEARN_ENABLED=true`. */
  learning?: ProbixLearningContext | null;
};

function buildSelectionProbabilityContext(
  learning: ProbixLearningContext | null | undefined,
  leagueName: string,
): SelectionProbabilityContext {
  if (!learning) return defaultSelectionProbabilityContext();
  return {
    calibration: learning.calibration,
    marketPScale: learning.marketPScale,
    familyReliability: learning.familyReliability,
    leagueProbFactor: learning.leagueProbFactor.get(leagueName) ?? 1,
  };
}

export async function runProbixEngine(
  fixture: NormalizedFixture,
  opts?: RunProbixEngineOptions,
): Promise<ProbixEngineOutput | null> {
  if (!engineAllowsLeague(fixture.leagueId)) return null;

  const learn = opts?.learning ?? null;
  if (learn?.hardBlockedLeagueNames.has(fixture.leagueName)) {
    return null;
  }

  const ctx = await loadProbixFixtureContext(fixture);
  if (!ctx) return null;

  const f = buildProbixFeatures(ctx);
  const rawCandidates = generateMarketCandidates(ctx, f);
  const enrichedBase = enrichCandidatesWithBookmakerDecimals(
    rawCandidates,
    opts?.oddsByMarketId,
    BOOK_ODDS_MIN,
    BOOK_ODDS_MAX,
  );

  const selectionMode = resolveSelectionModeName(
    process.env.PROBIX_SELECTION_MODE,
  );
  const enriched = filterCandidatesForSelectionPolicy(
    enrichedBase,
    selectionMode,
  );

  const weights = resolveSelectionWeightBundle(
    process.env.PROBIX_SELECTION_MODE,
  );
  const probability = buildSelectionProbabilityContext(
    learn,
    fixture.leagueName,
  );

  let selected = selectComboAndRisk(enriched, f, {
    weights,
    selectionMode,
    fixtureId: fixture.id,
    probability,
  });
  if (!selected?.picks?.length && fixture.bucket === "live") {
    selected =
      selectComboAndRisk(enriched, f, {
        mode: "liveRelaxed",
        weights,
        selectionMode,
        fixtureId: fixture.id,
        probability,
      }) ?? selected;
  }

  if (!selected?.picks?.length) return null;

  const picks = dedupeExclusiveMarketOrder(selected.picks);

  const confidenceAvg =
    picks.reduce((s, x) => s + x.confidence, 0) / picks.length;

  let estimatedCombinedDecimal = selected.estimatedCombinedDecimal;
  if (picks.length !== selected.picks.length) {
    const d = picks.reduce(
      (m, x) => m * (x.bookmakerDecimal ?? x.estimatedDecimal),
      1,
    );
    estimatedCombinedDecimal = Number(
      Math.min(80, Math.max(1.02, d)).toFixed(2),
    );
  }

  const explanationBullets = generateExplanationBullets(ctx, f, picks);

  return {
    picks,
    comboType: selected.comboType,
    comboScore: selected.comboScore,
    comboProbability: selected.comboProbability,
    totalEdge: selected.totalEdge,
    confidenceScore: selected.confidenceScore,
    confidenceAvg,
    estimatedCombinedDecimal,
    riskRating: selected.riskRating,
    explanationBullets,
    engineVersion: selected.engineVersion,
  };
}
