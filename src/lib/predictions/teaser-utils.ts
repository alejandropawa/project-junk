import type { PredictionPayload } from "@/lib/predictions/types";

/** Date minime pentru previzualizare conversie (fără selecții explicite). */
export type PredictionPublicTeaser = {
  confidenceScore: number;
  estimatedCombinedDecimal: number;
  pickCount: number;
};

export function teaserFromPayload(p: PredictionPayload): PredictionPublicTeaser {
  const confPct =
    p.confidenceScore ??
    (p.confidenceAvg >= 0 ? Math.round(p.confidenceAvg * 100) : 55);
  const combined =
    p.estimatedCombinedDecimal ??
    (p.picks?.length
      ? p.picks.reduce((m, x) => m * x.decimal, 1)
      : 1.85);
  return {
    confidenceScore: Math.min(100, Math.max(0, Math.round(confPct))),
    estimatedCombinedDecimal: Number(
      Math.min(40, Math.max(1.05, combined)).toFixed(2),
    ),
    pickCount: Math.max(1, p.picks?.length ?? 2),
  };
}
