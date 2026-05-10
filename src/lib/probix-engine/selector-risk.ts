import {
  CORRELATION_FAMILIES,
  CORRELATION_PENALTY,
  MAX_LEGS,
  MAX_PROB_PRODUCT,
  MIN_LEGS,
  MIN_MARKET_CONFIDENCE,
  MIN_MARKET_CONFIDENCE_LEG3,
  MIN_PROB_PRODUCT,
  PROBIX_ENGINE_VERSION,
  TARGET_PROB_PRODUCT,
} from "@/lib/probix-engine/config";
import type {
  MarketCandidate,
  ProbixFeatures,
  RiskRating,
} from "@/lib/probix-engine/types";

function probProduct(arr: MarketCandidate[]): number {
  return arr.reduce((m, x) => m * x.p, 1);
}

function combinedDecimalEstimate(arr: MarketCandidate[]): number {
  const d = arr.reduce((m, x) => m * x.estimatedDecimal, 1);
  return Number(Math.min(28, Math.max(1.2, d)).toFixed(2));
}

function pairwisePenalty(idA: string, idB: string): number {
  const h = CORRELATION_FAMILIES.high_goals;
  const l = CORRELATION_FAMILIES.low_goals;
  const cards = CORRELATION_FAMILIES.cards_high;
  let p = 0;
  if (h.has(idA) && h.has(idB)) p += CORRELATION_PENALTY;
  if (l.has(idA) && l.has(idB)) p += CORRELATION_PENALTY * 0.85;
  if ((h.has(idA) && l.has(idB)) || (h.has(idB) && l.has(idA)))
    p += CORRELATION_PENALTY * 1.35;
  if (cards.has(idA) && cards.has(idB)) p += CORRELATION_PENALTY * 0.9;
  if (h.has(idA) && cards.has(idB)) p += CORRELATION_PENALTY * 0.45;
  if (h.has(idB) && cards.has(idA)) p += CORRELATION_PENALTY * 0.45;
  return p;
}

function maxCorrPenaltyFor(id: string, chosen: MarketCandidate[]): number {
  if (chosen.length === 0) return 0;
  return Math.max(0, ...chosen.map((c) => pairwisePenalty(c.marketId, id)));
}

function riskFrom(
  picks: MarketCandidate[],
  f: ProbixFeatures,
  maxPen: number,
): RiskRating {
  const avgC =
    picks.reduce((s, x) => s + x.confidence, 0) / Math.max(1, picks.length);
  if (avgC >= 0.68 && maxPen < CORRELATION_PENALTY * 0.65 && f.dataQuality01 >= 0.65)
    return "low";
  if (avgC >= 0.58 && maxPen < CORRELATION_PENALTY * 1.2) return "medium";
  return "high";
}

export function selectComboAndRisk(
  candidates: MarketCandidate[],
  f: ProbixFeatures,
): {
  picks: MarketCandidate[];
  riskRating: RiskRating;
  estimatedCombinedDecimal: number;
  confidenceScore: number;
  confidenceAvg: number;
  engineVersion: string;
} {
  const pool = [...candidates]
    .filter((c) => c.confidence >= MIN_MARKET_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);

  const chosen: MarketCandidate[] = [];
  let maxPenUsed = 0;

  for (const c of pool) {
    if (chosen.length >= MAX_LEGS) break;
    const pen = maxCorrPenaltyFor(c.marketId, chosen);
    maxPenUsed = Math.max(maxPenUsed, pen);
    const adj = c.confidence * (1 - pen);
    const minC =
      chosen.length >= 2 ? MIN_MARKET_CONFIDENCE_LEG3 : MIN_MARKET_CONFIDENCE;
    if (adj < minC) continue;
    chosen.push(c);
  }

  if (chosen.length < MIN_LEGS) {
    for (const c of pool) {
      if (chosen.some((x) => x.marketId === c.marketId)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, chosen);
      const adj = c.confidence * (1 - pen * 0.88);
      if (adj < MIN_MARKET_CONFIDENCE_LEG3) continue;
      chosen.push(c);
      maxPenUsed = Math.max(maxPenUsed, pen);
      if (chosen.length >= MIN_LEGS) break;
    }
  }

  let picks = chosen.slice(0, MAX_LEGS);
  let pp = probProduct(picks);

  if (pp > MAX_PROB_PRODUCT && picks.length > 1) {
    const reduced = picks.slice(0, 2);
    if (probProduct(reduced) <= MAX_PROB_PRODUCT) {
      picks = reduced;
      pp = probProduct(picks);
    }
  }

  if (pp < MIN_PROB_PRODUCT && picks.length < MAX_LEGS) {
    for (const c of pool) {
      if (picks.some((x) => x.marketId === c.marketId)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, picks);
      const adj = c.confidence * (1 - pen);
      if (adj < MIN_MARKET_CONFIDENCE_LEG3) continue;
      const trial = [...picks, c];
      const tpp = probProduct(trial);
      if (tpp >= MIN_PROB_PRODUCT && tpp <= MAX_PROB_PRODUCT) {
        picks = trial;
        pp = tpp;
        maxPenUsed = Math.max(maxPenUsed, pen);
        break;
      }
    }
  }

  if (pp > TARGET_PROB_PRODUCT * 1.08 && picks.length < MAX_LEGS) {
    for (const c of pool) {
      if (picks.some((x) => x.marketId === c.marketId)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, picks);
      const adj = c.confidence * (1 - pen * 0.95);
      if (adj < MIN_MARKET_CONFIDENCE_LEG3) continue;
      const trial = [...picks, c];
      const tpp = probProduct(trial);
      if (tpp <= MAX_PROB_PRODUCT && tpp >= MIN_PROB_PRODUCT * 0.9) {
        picks = trial;
        pp = tpp;
        break;
      }
    }
  }

  const riskRating = riskFrom(picks, f, maxPenUsed);
  const confidenceAvg =
    picks.reduce((s, x) => s + x.confidence, 0) / Math.max(1, picks.length);

  const independenceBonus = Math.sqrt(pp) * 18;
  const dataBonus = f.dataQuality01 * 22;
  const riskCut =
    riskRating === "high" ? 12 : riskRating === "medium" ? 6 : 0;

  const confidenceScore = Math.round(
    Math.min(
      92,
      Math.max(
        38,
        confidenceAvg * 100 * 0.52 +
          independenceBonus +
          dataBonus -
          riskCut,
      ),
    ),
  );

  return {
    picks,
    riskRating,
    estimatedCombinedDecimal: combinedDecimalEstimate(picks),
    confidenceScore,
    confidenceAvg,
    engineVersion: PROBIX_ENGINE_VERSION,
  };
}
