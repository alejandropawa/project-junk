import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import { dedupeExclusiveMarketOrder } from "@/lib/probix-engine/market-exclusivity";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type {
  PredictionCalibrationSnapshot,
  PredictionPayload,
} from "@/lib/predictions/types";

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
        closingOdds: undefined,
        clvPercent: undefined,
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
      closingOdds: x.closingOdds,
      clvPercent: x.clvPercent,
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
