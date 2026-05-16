import {
  aggregateByLeague,
  aggregateByMarket,
  buildFamilyReliabilityScale,
  buildHardBlockedLeagueNames,
  buildLeagueProbFactors,
  buildMarketReliabilityScale,
  extractPickObservations,
  globalPickHitRate,
  hasMinimumLearningObservations,
} from "@/lib/probix-evolution/aggregate-history";
import { buildCalibrationBins } from "@/lib/probix-evolution/calibration-bins";
import {
  buildCalibrationBundle,
  inactiveCalibrationBundle,
} from "@/lib/probix-evolution/calibration-model";
import { calibrationFamilyKeyFromMarketId } from "@/lib/probix-evolution/market-family";
import {
  evolutionBrierCalibrated,
  evolutionBrierRaw,
  evolutionComboHitRates,
  evolutionEffectiveSelectionModeFromEnv,
  evolutionFamilyHits,
  evolutionMeanAbsCalibrationError,
  evolutionOddsSourcePerformance,
} from "@/lib/probix-evolution/evolution-metrics";
import type {
  LearningBuildSummary,
  ProbixEvolutionSummary,
  ProbixLearningContext,
  PredictionReportLite,
} from "@/lib/probix-evolution/types";
import { fetchPredictionReportsForLearning } from "@/lib/predictions/prediction-repository";
import type { SupabaseClient } from "@supabase/supabase-js";

function emptyLearning(summary: LearningBuildSummary): ProbixLearningContext {
  return {
    calibration: inactiveCalibrationBundle(),
    marketPScale: new Map(),
    leagueProbFactor: new Map(),
    familyReliability: new Map(),
    familySampleSize: new Map(),
    leagueSampleSize: new Map(),
    hardBlockedLeagueNames: new Set(),
    summary,
  };
}

/**
 * Construiește context de învățare din `prediction_reports` (picioare settle-ate).
 * Calibrarea globală se activează de la ≥500 observații; altfel probabilitățile rămân raw.
 */
export async function loadProbixLearningContext(
  sb: SupabaseClient,
  maxRows = 6_000,
): Promise<ProbixLearningContext> {
  const rows = await fetchPredictionReportsForLearning(sb, maxRows);
  return buildProbixLearningContextFromReports(rows);
}

export function buildProbixLearningContextFromReports(
  rows: readonly PredictionReportLite[],
): ProbixLearningContext {
  const obs = extractPickObservations(rows);
  const globalHit = globalPickHitRate(obs);
  const summary: LearningBuildSummary = {
    reportsRows: rows.length,
    pickObservations: obs.length,
    globalHitRate: globalHit,
  };

  if (obs.length < 24) {
    return emptyLearning(summary);
  }

  const calibration = buildCalibrationBundle(obs);
  const marketPScale = buildMarketReliabilityScale(obs);
  const leagueProbFactor = buildLeagueProbFactors(obs);
  const familyReliability = buildFamilyReliabilityScale(obs);
  const familySampleSize = new Map<string, number>();
  const leagueSampleSize = new Map(
    [...aggregateByLeague(obs)].map(([name, row]) => [name, row.n] as const),
  );
  for (const o of obs) {
    const fam = calibrationFamilyKeyFromMarketId(o.marketId);
    if (fam !== "unknown") {
      familySampleSize.set(fam, (familySampleSize.get(fam) ?? 0) + 1);
    }
  }
  const hardBlockedLeagueNames = buildHardBlockedLeagueNames(obs);

  return {
    calibration,
    marketPScale,
    leagueProbFactor,
    familyReliability,
    familySampleSize,
    leagueSampleSize,
    hardBlockedLeagueNames,
    summary,
  };
}

/** Pentru cron / gates: istoric suficient înainte de factori tari. */
export { hasMinimumLearningObservations };

/** Rezumat pentru API / debug (calibrare + piețe / ligi + metrici tuning). */
export function buildProbixEvolutionSummary(
  rows: readonly PredictionReportLite[],
): ProbixEvolutionSummary {
  const obs = extractPickObservations(rows);
  const byM = aggregateByMarket(obs);
  const byL = aggregateByLeague(obs);
  const leagueFactors = buildLeagueProbFactors(obs);

  const marketRows = [...byM.entries()]
    .map(([marketId, u]) => ({
      marketId,
      n: u.n,
      hit: u.n > 0 ? u.wins / u.n : 0,
      avgP: u.avgP,
      gap: u.n > 0 ? u.wins / u.n - u.avgP : 0,
    }))
    .filter((x) => x.n >= 8)
    .sort((a, b) => a.gap - b.gap);

  const topUndershoot = marketRows.slice(0, 12);
  const topOvershoot = [...marketRows].reverse().slice(0, 12);

  const leagues = [...byL.entries()]
    .map(([name, u]) => ({
      name,
      n: u.n,
      hit: u.n > 0 ? u.wins / u.n : 0,
    }))
    .filter((x) => x.n >= 6)
    .sort((a, b) => b.n - a.n)
    .slice(0, 40);

  const leagueReliabilitySample = [...byL.entries()]
    .map(([name, u]) => ({
      name,
      n: u.n,
      hit: u.n > 0 ? u.wins / u.n : 0,
      probFactor: leagueFactors.get(name) ?? 1,
    }))
    .filter((x) => x.n >= 6)
    .sort((a, b) => b.n - a.n)
    .slice(0, 36);

  const monitoring = {
    brierScoreRaw: evolutionBrierRaw(obs),
    brierScoreCalibrated: evolutionBrierCalibrated(obs),
    meanAbsCalibrationError: evolutionMeanAbsCalibrationError(obs),
    familyHits: evolutionFamilyHits(obs),
    oddsSourcePerformance: evolutionOddsSourcePerformance(obs),
    comboHitRates: evolutionComboHitRates(rows),
    effectiveSelectionModeApprox: evolutionEffectiveSelectionModeFromEnv(),
    leagueReliabilitySample,
  };

  return {
    learning: {
      reportsRows: rows.length,
      pickObservations: obs.length,
      globalHitRate: globalPickHitRate(obs),
    },
    calibrationBins: buildCalibrationBins(obs),
    topMarketsUndershoot: topUndershoot.map(
      ({ marketId, n, hit, avgP }) => ({ marketId, n, hit, avgP }),
    ),
    topMarketsOvershoot: topOvershoot.map(({ marketId, n, hit, avgP }) => ({
      marketId,
      n,
      hit,
      avgP,
    })),
    leagues,
    monitoring,
  };
}
