import type {
  ProbixEngineOutput,
  ProbixNoBetResult,
} from "@/lib/probix-engine/types";
import { dedupeExclusiveMarketOrder } from "@/lib/probix-engine/market-exclusivity";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type {
  PredictionCalibrationSnapshot,
  PredictionPayload,
} from "@/lib/predictions/types";

type EngineDecision = ProbixEngineOutput | ProbixNoBetResult;

function decisionShadowSummary(decision: EngineDecision) {
  if ("kind" in decision) {
    return {
      outcome: decision.outcome,
      noBetReason: decision.reason,
      pickCount: 0,
      marketFamilies: [],
      marketIds: [],
    };
  }

  return {
    outcome: decision.predictionOutcome ?? "MEDIUM_RISK",
    comboType: decision.comboType,
    pickCount: decision.picks.length,
    confidenceScore: decision.confidenceScore,
    estimatedCombinedDecimal: decision.estimatedCombinedDecimal,
    comboProbability: decision.comboProbability,
    totalEdge: decision.totalEdge,
    marketFamilies: [...new Set(decision.picks.map((p) => p.family))],
    marketIds: decision.picks.map((p) => p.marketId),
  };
}

export function buildPredictionShadowMode(
  gated: EngineDecision,
  ungated: EngineDecision,
): NonNullable<PredictionPayload["shadowMode"]> {
  return {
    generatedAt: new Date().toISOString(),
    ungated: decisionShadowSummary(ungated),
    gated: decisionShadowSummary(gated),
  };
}

/** Mapare rezultat motor → payload persistat (JSONB). */
export function engineOutputToPredictionPayload(
  out: ProbixEngineOutput,
  opts?: {
    oddsApiEventId?: number;
    fixtureId?: number;
    leagueId?: number;
    leagueName?: string;
  },
): PredictionPayload {
  const picks = dedupeExclusiveMarketOrder(
    out.picks.map((p) => {
      const dec = p.bookmakerDecimal ?? p.estimatedDecimal;
      return {
        marketLabel: p.label,
        selection: p.selection,
        decimal: Number(Number(dec).toFixed(2)),
        marketId: p.marketId,
        modelProb: Number(p.p.toFixed(4)),
        calibratedModelProb:
          p.calibratedProb != null
            ? Number(p.calibratedProb.toFixed(4))
            : undefined,
        bookmakerProb:
          p.bookmakerImpliedProb != null
            ? Number(p.bookmakerImpliedProb.toFixed(4))
            : undefined,
        edgeScore:
          p.edgeScore != null ? Number(p.edgeScore.toFixed(4)) : undefined,
        openingOdds: Number(Number(dec).toFixed(2)),
        publishedOdds: Number(Number(dec).toFixed(2)),
        currentOdds: Number(Number(dec).toFixed(2)),
        closingOdds: undefined,
        oddsMovementPct: p.oddsMovementPct,
        movedAgainstModel: p.movedAgainstModel,
        movedWithModel: p.movedWithModel,
        clvPercent: undefined,
        closingLineValuePct: undefined,
        flatStakeProfit: undefined,
        oddsSource: p.oddsSource,
        pickConfidence: Number(p.confidence.toFixed(4)),
        correlationTags: p.correlationTags
          ? [...p.correlationTags]
          : undefined,
      };
    }),
  );

  const narrative = out.explanationBullets.slice(0, 6).join("\n");
  const estimatedCombinedDecimal =
    combinedDecimalFromPicks(picks) ?? out.estimatedCombinedDecimal;

  const calibrationSnapshot: PredictionCalibrationSnapshot = {
    fixtureIdHint: opts?.fixtureId,
    leagueId: opts?.leagueId,
    leagueName: opts?.leagueName,
    comboType: out.comboType,
    comboScore: out.comboScore,
    comboProbability: out.comboProbability,
    totalEdge: out.totalEdge,
    combinedOddsAtGenerate: estimatedCombinedDecimal,
    picksDetail: picks.map((x) => ({
      marketId: x.marketId,
      modelProb: x.modelProb,
      calibratedModelProb: x.calibratedModelProb,
      bookmakerProb: x.bookmakerProb,
      bookmakerOdds: x.decimal,
      edgeScore: x.edgeScore,
      openingOdds: x.openingOdds,
      publishedOdds: x.publishedOdds,
      currentOdds: x.currentOdds,
      closingOdds: x.closingOdds,
      oddsMovementPct: x.oddsMovementPct,
      movedAgainstModel: x.movedAgainstModel,
      movedWithModel: x.movedWithModel,
      clvPercent: x.clvPercent,
      closingLineValuePct: x.closingLineValuePct,
      flatStakeProfit: x.flatStakeProfit,
      oddsSource: x.oddsSource,
      pickConfidence: x.pickConfidence,
      correlationTags: x.correlationTags,
    })),
  };

  return {
    generatedAt: new Date().toISOString(),
    oddsApiEventId: opts?.oddsApiEventId ?? 0,
    picks,
    confidenceAvg: Number(out.confidenceAvg.toFixed(4)),
    confidenceScore: out.confidenceScore,
    explanationBullets: out.explanationBullets,
    narrative,
    riskRating: out.riskRating,
    predictionOutcome: out.predictionOutcome,
    safetyStatus: out.predictionOutcome,
    volatilityReport: out.volatility,
    estimatedCombinedDecimal,
    comboType: out.comboType,
    comboScore: out.comboScore,
    comboProbability: out.comboProbability,
    totalEdge: out.totalEdge,
    calibrationSnapshot,
    settlement: "pending",
    /** Metadate deterministic (fără date personale). */
    modelClass: "probix-deterministic-stats",
    engineVersion: out.engineVersion,
  };
}

export function noBetToPredictionPayload(
  noBet: ProbixNoBetResult,
  opts?: {
    fixtureId?: number;
    leagueId?: number;
    leagueName?: string;
  },
): PredictionPayload {
  const explanation =
    noBet.volatility?.explanation ??
    "Probix did not find a candidate pool strong enough for publication.";

  return {
    generatedAt: new Date().toISOString(),
    oddsApiEventId: 0,
    picks: [],
    confidenceAvg: 0,
    confidenceScore: 0,
    explanationBullets: [explanation],
    narrative: explanation,
    riskRating: "high",
    predictionOutcome: "NO_BET",
    safetyStatus: "NO_BET",
    noBetReason: noBet.reason,
    volatilityReport: noBet.volatility,
    comboType: "single",
    comboScore: 0,
    comboProbability: 0,
    totalEdge: 0,
    calibrationSnapshot: {
      fixtureIdHint: opts?.fixtureId,
      leagueId: opts?.leagueId,
      leagueName: opts?.leagueName,
      comboType: "single",
      comboScore: 0,
      comboProbability: 0,
      totalEdge: 0,
      combinedOddsAtGenerate: undefined,
      picksDetail: [],
    },
    settlement: "void",
    modelClass: "probix-deterministic-stats",
    engineVersion: "probix-no-bet-v1",
  };
}
