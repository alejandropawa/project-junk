import type { ProbixEngineOutput } from "@/lib/probix-engine/types";
import { dedupeExclusiveMarketOrder } from "@/lib/probix-engine/market-exclusivity";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type { PredictionPayload } from "@/lib/predictions/types";

/** Mapare rezultat motor → payload persistat (JSONB). */
export function engineOutputToPredictionPayload(
  out: ProbixEngineOutput,
  opts?: { oddsApiEventId?: number },
): PredictionPayload {
  const picks = dedupeExclusiveMarketOrder(
    out.picks.map((p) => ({
      marketLabel: p.label,
      selection: p.selection,
      decimal: p.estimatedDecimal,
      marketId: p.marketId,
    })),
  );

  const narrative = out.explanationBullets.slice(0, 6).join("\n");
  const estimatedCombinedDecimal =
    combinedDecimalFromPicks(picks) ?? out.estimatedCombinedDecimal;

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
    engineVersion: out.engineVersion,
    settlement: "pending",
    /** Metadate deterministic (fără date personale). */
    modelClass: "probix-deterministic-stats",
  };
}
