import { applyCalibration } from "@/lib/probix-evolution/calibration-model";
import {
  calibrationFamilyKeyFromMarketId,
  type CalibrationFamilyKey,
} from "@/lib/probix-evolution/market-family";
import type { ProbixLearningContext } from "@/lib/probix-evolution/types";
import { comboStructuralPenaltySum } from "@/lib/probix-engine/selector-correlation";
import type { MarketFamily, OddsSource, ProbixComboType } from "@/lib/probix-engine/types";

export type NoBetReason =
  | "insufficient_edge"
  | "low_data_quality"
  | "poor_league_history"
  | "no_real_odds"
  | "high_correlation"
  | "volatile_avoid"
  | "insufficient_candidate_pool"
  | "odds_moved_against_model";

export type ValueGateCandidateInput = {
  marketId: string;
  family: MarketFamily;
  rawProbability: number;
  decimal: number;
  oddsSource: OddsSource;
};

export type ValueGateCandidate = ValueGateCandidateInput & {
  calibratedProbability: number;
  impliedProbability: number;
  estimatedEdge: number;
  marketReliabilityFactor: number;
  familyReliabilityFactor: number;
  leagueReliabilityFactor: number;
  reliabilityFactor: number;
  finalAdjustedProbability: number;
  finalEdge: number;
  rejectedReasons: NoBetReason[];
  familySampleSize: number;
};

export type ValueGateComboResult =
  | {
      accepted: true;
      comboType: ProbixComboType;
      candidates: ValueGateCandidate[];
      totalEdge: number;
      comboProbability: number;
      debug: ValueGateDebug;
    }
  | {
      accepted: false;
      reason: NoBetReason;
      comboType: ProbixComboType;
      candidates: ValueGateCandidate[];
      totalEdge: number;
      comboProbability: number;
      debug: ValueGateDebug;
    };

export type ValueGateDebug = {
  rejectedCandidates: Array<{
    marketId: string;
    family: MarketFamily;
    reasons: NoBetReason[];
    rawP: number;
    calibratedP: number;
    impliedP: number;
    edge: number;
    marketReliabilityFactor: number;
    leagueReliabilityFactor: number;
    finalP: number;
  }>;
  comboRejectedReason?: NoBetReason;
};

const EDGE_BY_COMBO_TYPE: Record<ProbixComboType, number> = {
  single: 0.04,
  double: 0.06,
  triple: 0.08,
};

const RISKY_FAMILY_MIN_SAMPLES = 120;
const RISKY_FAMILIES = new Set<CalibrationFamilyKey>(["btts", "dc", "goals"]);
const POOR_LEAGUE_FACTOR = 0.82;
const HIGH_CORRELATION_SUM = 0.52;

function clampProbability(p: number): number {
  return Math.min(0.94, Math.max(0.05, p));
}

export function familyReliabilityKey(family: MarketFamily): CalibrationFamilyKey {
  if (family === "btts") return "btts";
  if (family === "result_safe") return "dc";
  if (family === "corners") return "corners";
  if (family === "cards") return "cards";
  if (family === "fouls") return "fouls";
  if (family === "goals_high" || family === "goals_low") return "goals";
  return "unknown";
}

export function buildValueGateCandidate(
  input: ValueGateCandidateInput,
  learning: ProbixLearningContext | null | undefined,
  leagueName: string,
): ValueGateCandidate {
  const calibratedProbability = applyCalibration(
    input.rawProbability,
    input.marketId,
    learning?.calibration,
  );
  const impliedProbability = 1 / input.decimal;
  const marketReliabilityFactor = learning?.marketPScale.get(input.marketId) ?? 1;
  const fam = familyReliabilityKey(input.family);
  const historyFam = calibrationFamilyKeyFromMarketId(input.marketId);
  const familyKey = fam === "unknown" ? historyFam : fam;
  const familyReliabilityFactor = learning?.familyReliability.get(familyKey) ?? 1;
  const leagueReliabilityFactor = learning?.leagueProbFactor.get(leagueName) ?? 1;
  const reliabilityFactor =
    marketReliabilityFactor * familyReliabilityFactor * leagueReliabilityFactor;
  const finalAdjustedProbability = clampProbability(
    calibratedProbability * reliabilityFactor,
  );
  const estimatedEdge = input.rawProbability - impliedProbability;
  const finalEdge = finalAdjustedProbability - impliedProbability;
  const familySampleSize = learning?.familySampleSize.get(familyKey) ?? 0;

  const rejectedReasons: NoBetReason[] = [];
  if (input.oddsSource === "synthetic_fallback") rejectedReasons.push("no_real_odds");
  if (
    learning &&
    RISKY_FAMILIES.has(familyKey) &&
    familySampleSize < RISKY_FAMILY_MIN_SAMPLES
  ) {
    rejectedReasons.push("low_data_quality");
  }
  if (learning && leagueReliabilityFactor <= POOR_LEAGUE_FACTOR) {
    rejectedReasons.push("poor_league_history");
  }

  return {
    ...input,
    calibratedProbability,
    impliedProbability,
    estimatedEdge,
    marketReliabilityFactor,
    familyReliabilityFactor,
    leagueReliabilityFactor,
    reliabilityFactor,
    finalAdjustedProbability,
    finalEdge,
    rejectedReasons,
    familySampleSize,
  };
}

export function evaluateValueGateCombo(
  candidates: readonly ValueGateCandidate[],
  comboType: ProbixComboType,
): ValueGateComboResult {
  const threshold = EDGE_BY_COMBO_TYPE[comboType];
  const corrSum = comboStructuralPenaltySum(candidates.map((c) => c.marketId));
  const totalEdge = candidates.reduce((sum, c) => sum + c.finalEdge, 0);
  const comboProbability =
    candidates.reduce((prod, c) => prod * c.finalAdjustedProbability, 1) *
    Math.pow(0.96, Math.max(0, candidates.length - 1));

  const rejectedCandidates = candidates
    .filter((c) => c.rejectedReasons.length > 0)
    .map((c) => ({
      marketId: c.marketId,
      family: c.family,
      reasons: c.rejectedReasons,
      rawP: c.rawProbability,
      calibratedP: c.calibratedProbability,
      impliedP: c.impliedProbability,
      edge: c.finalEdge,
      marketReliabilityFactor: c.marketReliabilityFactor,
      leagueReliabilityFactor: c.leagueReliabilityFactor,
      finalP: c.finalAdjustedProbability,
    }));

  let reason: NoBetReason | null = null;
  if (rejectedCandidates.some((c) => c.reasons.includes("no_real_odds"))) {
    reason = "no_real_odds";
  } else if (rejectedCandidates.some((c) => c.reasons.includes("low_data_quality"))) {
    reason = "low_data_quality";
  } else if (rejectedCandidates.some((c) => c.reasons.includes("poor_league_history"))) {
    reason = "poor_league_history";
  } else if (corrSum >= HIGH_CORRELATION_SUM) {
    reason = "high_correlation";
  } else if (totalEdge < threshold) {
    reason = "insufficient_edge";
  }

  const debug: ValueGateDebug = {
    rejectedCandidates,
    comboRejectedReason: reason ?? undefined,
  };

  if (reason) {
    return {
      accepted: false,
      reason,
      comboType,
      candidates: [...candidates],
      totalEdge,
      comboProbability,
      debug,
    };
  }

  return {
    accepted: true,
    comboType,
    candidates: [...candidates],
    totalEdge,
    comboProbability,
    debug,
  };
}
