import {
  COMBO_CORR_PROB_DAMAGE_CAP,
  COMBO_HARD_CORRELATION_REJECT_SUM,
  MAX_CANDIDATES_FOR_COMBO_SEARCH,
  MIN_DATA_QUALITY_FOR_PREDICTION,
  MIN_LEGS,
  MIN_MARKET_CONFIDENCE,
  MIN_MARKET_CONFIDENCE_LEG3,
  MODEL_PROB_POOL_MAX,
  MODEL_PROB_POOL_MIN,
  PROBIX_ENGINE_VERSION,
  TRIPLE_SCORE_IMPROVE_OVER_DOUBLE,
} from "@/lib/probix-engine/config";
import {
  marketAggressionPenalty,
  marketPreferenceBoost,
} from "@/lib/probix-engine/enrich-candidates-odds";
import { hitRateTripleAllowed } from "@/lib/probix-engine/selection-market-policy";
import { getMarketStabilityMultiplier } from "@/lib/probix-engine/market-stability";
import {
  dedupeExclusiveMarketOrder,
  exclusiveMarketConflict,
} from "@/lib/probix-engine/market-exclusivity";
import { comboStructuralPenaltySum } from "@/lib/probix-engine/selector-correlation";
import type {
  MarketCandidate,
  ProbixComboType,
  ProbixFeatures,
  RiskRating,
} from "@/lib/probix-engine/types";
import {
  applyCalibration,
  inactiveCalibrationBundle,
  type CalibrationBundle,
} from "@/lib/probix-evolution/calibration-model";
import { calibrationFamilyKeyFromMarketId } from "@/lib/probix-evolution/market-family";
import {
  defaultSelectionWeightBundle,
  type ProbixSelectionModeName,
  type SelectionWeightBundle,
} from "@/lib/probix-evolution/selection-profile";

const EXPLORATION_RATE_PCT = 8;

type EnrichedCandidate = MarketCandidate &
  Required<
    Pick<
      MarketCandidate,
      | "bookmakerDecimal"
      | "bookmakerImpliedProb"
      | "edgeScore"
      | "oddsSource"
      | "correlationTags"
    >
  >;

type ComboWinner = {
  picks: EnrichedCandidate[];
  comboType: ProbixComboType;
  comboScore: number;
  comboProbability: number;
  totalEdge: number;
  corrSum: number;
};

/** Probabilități ajustate: calibrare × istoric piață × familie × stabilitate; ligă pe combo. */
export type SelectionProbabilityContext = {
  calibration: CalibrationBundle;
  marketPScale: ReadonlyMap<string, number>;
  familyReliability: ReadonlyMap<string, number>;
  leagueProbFactor: number;
};

export function defaultSelectionProbabilityContext(): SelectionProbabilityContext {
  return {
    calibration: inactiveCalibrationBundle(),
    marketPScale: new Map(),
    familyReliability: new Map(),
    leagueProbFactor: 1,
  };
}

export function effectiveLegProbability(
  c: Pick<MarketCandidate, "p" | "marketId">,
  prob: SelectionProbabilityContext,
): number {
  const cal = applyCalibration(c.p, c.marketId, prob.calibration);
  const m = prob.marketPScale.get(c.marketId) ?? 1;
  const fam = calibrationFamilyKeyFromMarketId(c.marketId);
  const fr = prob.familyReliability.get(fam) ?? 1;
  const st = getMarketStabilityMultiplier(c.marketId);
  return Math.min(0.94, Math.max(0.05, cal * m * fr * st));
}

type RuntimeCtx = {
  w: SelectionWeightBundle;
  prob: SelectionProbabilityContext;
  selectionMode: ProbixSelectionModeName;
  fixtureId?: number;
};

function isFullyEnriched(c: MarketCandidate): c is EnrichedCandidate {
  return (
    typeof c.bookmakerDecimal === "number" &&
    typeof c.bookmakerImpliedProb === "number" &&
    typeof c.edgeScore === "number" &&
    c.oddsSource != null &&
    Array.isArray(c.correlationTags)
  );
}

function marketCompositeScore(
  c: MarketCandidate,
  f: ProbixFeatures,
  rt: RuntimeCtx,
): number {
  const ep = effectiveLegProbability(c, rt.prob);
  const edgeTerm =
    c.oddsSource === "bookmaker"
      ? (c.edgeScore ?? 0) * rt.w.selectionEdgeWeight
      : 0;
  const probTerm = ep * rt.w.selectionProbWeight;
  const probLeanTerm = rt.w.poolRankProbLean * (ep - 0.52);
  const dataTerm = f.dataQuality01 * rt.w.selectionDataWeight;
  const prefTerm =
    marketPreferenceBoost(c.marketId) * rt.w.selectionPrefWeight * 18;
  const aggPenalty =
    marketAggressionPenalty(c.marketId) * rt.w.selectionAggWeight * 22;
  return edgeTerm + probTerm + probLeanTerm + dataTerm + prefTerm - aggPenalty;
}

function comboExclusiveOk(legs: EnrichedCandidate[]): boolean {
  for (let i = 1; i < legs.length; i++) {
    if (exclusiveMarketConflict(legs[i].marketId, legs.slice(0, i))) {
      return false;
    }
  }
  const ids = dedupeExclusiveMarketOrder(legs);
  return ids.length === legs.length;
}

function syntheticMultiAdjust(
  legs: EnrichedCandidate[],
  selectionMode: ProbixSelectionModeName,
): { probMul: number; scoreMul: number } {
  if (legs.length < 2) return { probMul: 1, scoreMul: 1 };
  const syn = legs.filter((x) => x.oddsSource === "synthetic_fallback").length;
  if (!syn) return { probMul: 1, scoreMul: 1 };
  const allSyn = syn >= legs.length;
  if (selectionMode === "hit_rate") {
    return allSyn ? { probMul: 0.61, scoreMul: 0.78 } : { probMul: 0.68, scoreMul: 0.84 };
  }
  return allSyn ? { probMul: 0.66, scoreMul: 0.83 } : { probMul: 0.72, scoreMul: 0.88 };
}

function hitRateComboScoreBias(legCount: number): number {
  if (legCount <= 1) return 0;
  if (legCount === 2) return 0.044;
  return 0.112;
}

function evaluateCombo(
  legs: EnrichedCandidate[],
  rt: RuntimeCtx,
): null | {
  score: number;
  comboProbability: number;
  totalEdge: number;
  corrSum: number;
} {
  const ids = legs.map((x) => x.marketId);
  const corrSum = comboStructuralPenaltySum(ids);
  if (corrSum >= COMBO_HARD_CORRELATION_REJECT_SUM) return null;

  let prod = 1;
  for (const x of legs) {
    prod *= effectiveLegProbability(x, rt.prob);
  }
  const damage = Math.min(COMBO_CORR_PROB_DAMAGE_CAP, corrSum);
  const lf = rt.prob.leagueProbFactor;
  const leagueClamp = Math.min(1.09, Math.max(0.82, lf));
  const { probMul, scoreMul } = syntheticMultiAdjust(legs, rt.selectionMode);
  const comboProbability = prod * (1 - damage) * leagueClamp * probMul;

  let totalEdge = 0;
  for (const x of legs) {
    if (x.oddsSource === "bookmaker") totalEdge += x.edgeScore;
  }

  let score =
    comboProbability * rt.w.comboProbWeight +
    totalEdge * rt.w.comboEdgeWeight -
    corrSum * rt.w.comboCorrWeight;
  score *= scoreMul;

  if (rt.selectionMode === "hit_rate") {
    score -= hitRateComboScoreBias(legs.length);
  }

  return { score, comboProbability, totalEdge, corrSum };
}

function bookLegEdgesOkForCombo(
  legs: EnrichedCandidate[],
  floor: number,
): boolean {
  if (legs.length < 2) return true;
  for (const x of legs) {
    if (x.oddsSource !== "bookmaker") continue;
    if (x.edgeScore < floor) return false;
  }
  return true;
}

function upsertWinner(
  current: ComboWinner | null,
  legs: EnrichedCandidate[],
  type: ProbixComboType,
  rt: RuntimeCtx,
  minConfidenceLeg3?: number,
): ComboWinner | null {
  const hit = rt.selectionMode === "hit_rate";
  if (type === "triple" && minConfidenceLeg3 != null) {
    if (legs.some((x) => x.confidence < minConfidenceLeg3)) return current;
  }
  if (!comboExclusiveOk(legs)) return current;
  if (!bookLegEdgesOkForCombo(legs, rt.w.bookComboMinLegEdge)) return current;

  const syn = legs.filter((x) => x.oddsSource === "synthetic_fallback").length;

  if (hit) {
    if (type === "triple") {
      if (!hitRateTripleAllowed(legs, rt.w.bookComboMinLegEdge)) return current;
      if (syn > 0) return current;
    }
    if (legs.length > 1 && syn === legs.length) return current;
  }

  const ev = evaluateCombo(legs, rt);
  if (!ev) return current;

  const combinedD = legs.reduce((m, x) => m * x.bookmakerDecimal, 1);
  if (!(combinedD >= 1.05)) return current;

  const next: ComboWinner = {
    picks: legs,
    comboType: type,
    comboScore: ev.score,
    comboProbability: ev.comboProbability,
    totalEdge: ev.totalEdge,
    corrSum: ev.corrSum,
  };

  if (!current || next.comboScore > current.comboScore + 1e-9) return next;
  return current;
}

function riskFromCorr(corrSum: number, avgConf: number, dq: number): RiskRating {
  if (corrSum <= 0.22 && avgConf >= 0.66 && dq >= 0.62) {
    return "low";
  }
  if (corrSum <= 0.42 && avgConf >= 0.55) return "medium";
  return "high";
}

function explorationActive(fixtureId: number | undefined): boolean {
  if (fixtureId == null) return false;
  const u = (fixtureId * 1103515245 + 12345) >>> 0;
  return u % 100 < EXPLORATION_RATE_PCT;
}

function buildSearchSlice(
  ranked: EnrichedCandidate[],
  fixtureId: number | undefined,
): EnrichedCandidate[] {
  const MAX = MAX_CANDIDATES_FOR_COMBO_SEARCH;
  let s = ranked.slice(0, MAX);
  if (
    explorationActive(fixtureId) &&
    fixtureId != null &&
    ranked.length > MAX + 10
  ) {
    const span = Math.min(14, ranked.length - 20);
    if (span > 0) {
      const j = 20 + Math.abs(fixtureId % span);
      const donor = ranked[j];
      const last = s.length - 1;
      if (
        donor &&
        !s.slice(0, last).some((x) => x.marketId === donor.marketId)
      ) {
        s = s.slice();
        s[last] = donor;
      }
    }
  }
  return s;
}

export function selectComboAndRisk(
  enrichedCandidates: MarketCandidate[],
  f: ProbixFeatures,
  opts?: {
    mode?: "default" | "liveRelaxed";
    weights?: SelectionWeightBundle;
    selectionMode?: ProbixSelectionModeName;
    fixtureId?: number;
    probability?: SelectionProbabilityContext | null;
  },
): {
  picks: MarketCandidate[];
  comboType: ProbixComboType;
  comboScore: number;
  comboProbability: number;
  totalEdge: number;
  estimatedCombinedDecimal: number;
  riskRating: RiskRating;
  confidenceScore: number;
  confidenceAvg: number;
  engineVersion: string;
} | null {
  const w = opts?.weights ?? defaultSelectionWeightBundle();
  const selectionMode = opts?.selectionMode ?? "balanced";
  const prob =
    opts?.probability != null
      ? opts.probability
      : defaultSelectionProbabilityContext();
  const rt: RuntimeCtx = {
    w,
    prob,
    selectionMode,
    fixtureId: opts?.fixtureId,
  };

  const relaxed = opts?.mode === "liveRelaxed";
  const minC0 = relaxed
    ? Math.min(MIN_MARKET_CONFIDENCE, 0.42)
    : MIN_MARKET_CONFIDENCE;
  const minCleg3 = relaxed
    ? Math.min(MIN_MARKET_CONFIDENCE_LEG3, 0.4)
    : MIN_MARKET_CONFIDENCE_LEG3;

  const base = enrichedCandidates.filter(isFullyEnriched);
  if (!base.length) return null;

  if (f.dataQuality01 < MIN_DATA_QUALITY_FOR_PREDICTION) return null;

  const poolPrep = base.filter(
    (c) =>
      c.confidence >= minC0 &&
      c.p >= MODEL_PROB_POOL_MIN &&
      c.p <= MODEL_PROB_POOL_MAX,
  );

  const pool =
    poolPrep.length >= MIN_LEGS
      ? poolPrep
      : base.filter((c) => c.confidence >= minC0 * 0.95);

  if (!pool.length) return null;

  const ranked = pool
    .filter(isFullyEnriched)
    .sort((a, b) => {
      const sa = marketCompositeScore(a, f, rt);
      const sb = marketCompositeScore(b, f, rt);
      return sb - sa;
    });

  const slice = buildSearchSlice(ranked, opts?.fixtureId);

  const n = slice.length;
  if (!n) return null;

  let bestSingle: ComboWinner | null = null;
  let bestDouble: ComboWinner | null = null;
  let bestTriple: ComboWinner | null = null;

  for (let i = 0; i < n; i++) {
    bestSingle = upsertWinner(bestSingle, [slice[i]], "single", rt);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      bestDouble = upsertWinner(
        bestDouble,
        [slice[i], slice[j]],
        "double",
        rt,
      );
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        bestTriple = upsertWinner(
          bestTriple,
          [slice[i], slice[j], slice[k]],
          "triple",
          rt,
          minCleg3,
        );
      }
    }
  }

  const finalists: ComboWinner[] = [];
  if (bestSingle) finalists.push(bestSingle);
  if (bestDouble) finalists.push(bestDouble);

  const hit = selectionMode === "hit_rate";
  let tripleEligible = false;
  if (bestTriple && bestDouble) {
    tripleEligible =
      bestTriple.comboScore >=
      bestDouble.comboScore + TRIPLE_SCORE_IMPROVE_OVER_DOUBLE;
  } else if (bestTriple && !bestDouble && bestSingle) {
    tripleEligible = bestTriple.comboScore >= bestSingle.comboScore + 0.02;
  }
  if (hit && bestTriple) {
    tripleEligible =
      tripleEligible &&
      hitRateTripleAllowed(bestTriple.picks, w.bookComboMinLegEdge);
  }
  if (bestTriple && tripleEligible) finalists.push(bestTriple);

  if (!finalists.length) return null;

  let best = finalists[0];
  for (let i = 1; i < finalists.length; i++) {
    const x = finalists[i];
    const d = x.comboScore - best.comboScore;
    if (d > w.finalistScoreNearEps) best = x;
    else if (Math.abs(d) <= w.finalistScoreNearEps) {
      if (hit) {
        if (x.picks.length < best.picks.length) best = x;
        else if (
          x.picks.length === best.picks.length &&
          x.comboProbability > best.comboProbability + 1e-9
        )
          best = x;
      } else if (x.comboProbability > best.comboProbability + 1e-9) {
        best = x;
      }
    }
  }

  let picksClean = dedupeExclusiveMarketOrder(best.picks);
  picksClean = picksClean.filter(isFullyEnriched);

  const picksAttached = picksClean.map((p) => {
    const calibratedProb = effectiveLegProbability(p, prob);
    return { ...p, calibratedProb };
  });

  best = { ...best, picks: picksAttached };

  const confidenceAvg =
    best.picks.reduce((s, x) => s + x.confidence, 0) /
    Math.max(1, best.picks.length);

  const riskRating = riskFromCorr(
    best.corrSum,
    confidenceAvg,
    f.dataQuality01,
  );

  const independenceHint = Math.sqrt(Math.max(1e-9, best.comboProbability));
  const dataBonus = f.dataQuality01 * 20;
  const riskCut =
    riskRating === "high" ? 14 : riskRating === "medium" ? 7 : 0;
  const legBonus =
    best.picks.length === 1 ? 10 : best.picks.length === 2 ? 4 : 0;

  const confidenceScore = Math.round(
    Math.min(
      92,
      Math.max(
        36,
        best.comboScore * 58 +
          confidenceAvg * 100 * 0.28 +
          independenceHint * 12 +
          dataBonus -
          riskCut +
          legBonus,
      ),
    ),
  );

  const estimatedCombinedDecimal = Number(
    Math.min(
      80,
      Math.max(
        1.02,
        best.picks.reduce((m, x) => m * x.bookmakerDecimal, 1),
      ),
    ).toFixed(2),
  );

  return {
    picks: best.picks,
    comboType: best.comboType,
    comboScore: Number(best.comboScore.toFixed(4)),
    comboProbability: Number(best.comboProbability.toFixed(4)),
    totalEdge: Number(best.totalEdge.toFixed(4)),
    estimatedCombinedDecimal,
    riskRating,
    confidenceScore,
    confidenceAvg,
    engineVersion: PROBIX_ENGINE_VERSION,
  };
}
