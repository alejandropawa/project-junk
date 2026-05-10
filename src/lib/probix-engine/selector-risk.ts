import {
  CORRELATION_PENALTY,
  MAX_LEGS,
  MAX_PROB_PRODUCT,
  MIN_COMBINED_DECIMAL_PROBIX,
  MIN_LEGS,
  MIN_MARKET_CONFIDENCE,
  MIN_MARKET_CONFIDENCE_LEG3,
  MIN_PROB_PRODUCT,
  PROBIX_ENGINE_VERSION,
  TARGET_PROB_PRODUCT,
} from "@/lib/probix-engine/config";
import {
  dedupeExclusiveMarketOrder,
  exclusiveMarketConflict,
} from "@/lib/probix-engine/market-exclusivity";
import * as Corr from "@/lib/probix-engine/market-correlation";
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
  const hA = Corr.isHighGoalsFamily(idA);
  const hB = Corr.isHighGoalsFamily(idB);
  const lA = Corr.isLowGoalsFamily(idA);
  const lB = Corr.isLowGoalsFamily(idB);
  const cA = Corr.isCardsHighCorrelated(idA);
  const cB = Corr.isCardsHighCorrelated(idB);
  let p = 0;
  if (hA && hB) p += CORRELATION_PENALTY;
  if (lA && lB) p += CORRELATION_PENALTY * 0.85;
  if ((hA && lB) || (hB && lA)) p += CORRELATION_PENALTY * 1.35;
  if (cA && cB) p += CORRELATION_PENALTY * 0.9;
  if (hA && cB) p += CORRELATION_PENALTY * 0.45;
  if (hB && cA) p += CORRELATION_PENALTY * 0.45;

  const cnA = Corr.isCornersOverId(idA) || Corr.isCornersUnderId(idA);
  const cnB = Corr.isCornersOverId(idB) || Corr.isCornersUnderId(idB);
  const fA = Corr.isFoulsOverId(idA) || Corr.isFoulsUnderId(idA);
  const fB = Corr.isFoulsOverId(idB) || Corr.isFoulsUnderId(idB);
  if (cnA && cnB) p += CORRELATION_PENALTY * 0.32;
  if (fA && fB) p += CORRELATION_PENALTY * 0.28;
  if ((hA && cnB) || (hB && cnA)) p += CORRELATION_PENALTY * 0.22;
  if ((lA && cnB) || (lB && cnA)) p += CORRELATION_PENALTY * 0.18;
  return p;
}

function ensureMinCombinedDecimal(
  picks: MarketCandidate[],
  pool: MarketCandidate[],
): MarketCandidate[] {
  let out = [...picks];
  let d = combinedDecimalEstimate(out);
  if (d >= MIN_COMBINED_DECIMAL_PROBIX) return out;

  const poolSorted = [...pool].sort(
    (a, b) => b.estimatedDecimal - a.estimatedDecimal,
  );

  if (out.length < MAX_LEGS) {
    for (const c of poolSorted) {
      if (out.some((x) => x.marketId === c.marketId)) continue;
      if (exclusiveMarketConflict(c.marketId, out)) continue;
      const trial = [...out, c].slice(0, MAX_LEGS);
      if (dedupeExclusiveMarketOrder(trial).length !== trial.length) continue;
      const tpp = probProduct(trial);
      if (tpp > MAX_PROB_PRODUCT * 1.045) continue;
      const td = combinedDecimalEstimate(trial);
      if (td >= MIN_COMBINED_DECIMAL_PROBIX) return trial;
    }
  }

  for (const c of poolSorted) {
    for (let i = 0; i < out.length; i++) {
      const trial = out.map((item, j) => (j === i ? c : item));
      if (new Set(trial.map((t) => t.marketId)).size !== trial.length)
        continue;
      if (dedupeExclusiveMarketOrder(trial).length !== trial.length) continue;
      const tpp = probProduct(trial);
      if (tpp > MAX_PROB_PRODUCT * 1.07) continue;
      const td = combinedDecimalEstimate(trial);
      if (td > d) {
        out = trial;
        d = td;
        if (d >= MIN_COMBINED_DECIMAL_PROBIX) return out;
      }
    }
  }
  return out;
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
  opts?: { mode?: "default" | "liveRelaxed" },
): {
  picks: MarketCandidate[];
  riskRating: RiskRating;
  estimatedCombinedDecimal: number;
  confidenceScore: number;
  confidenceAvg: number;
  engineVersion: string;
} {
  const relaxed = opts?.mode === "liveRelaxed";
  const minC0 = relaxed
    ? Math.min(MIN_MARKET_CONFIDENCE, 0.48)
    : MIN_MARKET_CONFIDENCE;
  const minCleg3 = relaxed
    ? Math.min(MIN_MARKET_CONFIDENCE_LEG3, 0.44)
    : MIN_MARKET_CONFIDENCE_LEG3;
  const minProdFloor = relaxed ? MIN_PROB_PRODUCT * 0.82 : MIN_PROB_PRODUCT;

  const pool = [...candidates]
    .filter((c) => c.confidence >= minC0)
    .sort((a, b) => b.confidence - a.confidence);

  const chosen: MarketCandidate[] = [];
  let maxPenUsed = 0;

  for (const c of pool) {
    if (chosen.length >= MAX_LEGS) break;
    if (exclusiveMarketConflict(c.marketId, chosen)) continue;
    const pen = maxCorrPenaltyFor(c.marketId, chosen);
    maxPenUsed = Math.max(maxPenUsed, pen);
    const adj = c.confidence * (1 - pen);
    const minC = chosen.length >= 2 ? minCleg3 : minC0;
    if (adj < minC) continue;
    chosen.push(c);
  }

  if (chosen.length < MIN_LEGS) {
    for (const c of pool) {
      if (chosen.some((x) => x.marketId === c.marketId)) continue;
      if (exclusiveMarketConflict(c.marketId, chosen)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, chosen);
      const adj = c.confidence * (1 - pen * 0.88);
      if (adj < minCleg3) continue;
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

  if (pp < minProdFloor && picks.length < MAX_LEGS) {
    for (const c of pool) {
      if (picks.some((x) => x.marketId === c.marketId)) continue;
      if (exclusiveMarketConflict(c.marketId, picks)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, picks);
      const adj = c.confidence * (1 - pen);
      if (adj < minCleg3) continue;
      const trial = [...picks, c];
      const tpp = probProduct(trial);
      if (tpp >= minProdFloor && tpp <= MAX_PROB_PRODUCT) {
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
      if (exclusiveMarketConflict(c.marketId, picks)) continue;
      const pen = maxCorrPenaltyFor(c.marketId, picks);
      const adj = c.confidence * (1 - pen * 0.95);
      if (adj < minCleg3) continue;
      const trial = [...picks, c];
      const tpp = probProduct(trial);
      if (tpp <= MAX_PROB_PRODUCT && tpp >= minProdFloor * 0.9) {
        picks = trial;
        pp = tpp;
        break;
      }
    }
  }

  picks = ensureMinCombinedDecimal(picks, pool);
  pp = probProduct(picks);
  let pairPen = 0;
  for (let i = 0; i < picks.length; i++) {
    for (let j = 0; j < i; j++) {
      pairPen = Math.max(
        pairPen,
        pairwisePenalty(picks[i].marketId, picks[j].marketId),
      );
    }
  }
  maxPenUsed = Math.max(maxPenUsed, pairPen);

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
