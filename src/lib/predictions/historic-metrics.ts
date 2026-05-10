import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import type {
  PredictionPayload,
  PredictionSettlement,
} from "@/lib/predictions/types";

function settlementOf(p: PredictionPayload): PredictionSettlement {
  return p.settlement ?? "pending";
}

function combinedDecimalForRoi(p: PredictionPayload): number | null {
  if (
    p.estimatedCombinedDecimal != null &&
    Number.isFinite(p.estimatedCombinedDecimal) &&
    p.estimatedCombinedDecimal > 1
  ) {
    return p.estimatedCombinedDecimal;
  }
  return combinedDecimalFromPicks(p.picks);
}

/**
 * Indicatori din toate predicțiile persistate: număr total, acuratețe combinație (won /
 * won+lost, fără void/pending), ROI mediu pe predicție rezolvată (miză 1 u.a. /
 * combinație, profit = cotă − 1 la WIN, −1 la LOST).
 */
export function summarizeHistoricEngineMetrics(payloads: PredictionPayload[]) {
  let total = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let voided = 0;
  let settledForRoi = 0;
  let profitUnits = 0;

  for (const p of payloads) {
    total += 1;
    const s = settlementOf(p);
    if (s === "pending") {
      pending += 1;
      continue;
    }
    if (s === "void") {
      voided += 1;
      continue;
    }
    const dec = combinedDecimalForRoi(p);
    if (s === "won") {
      won += 1;
      settledForRoi += 1;
      profitUnits += dec != null && dec > 1 ? dec - 1 : 0;
      continue;
    }
    if (s === "lost") {
      lost += 1;
      settledForRoi += 1;
      profitUnits -= 1;
    }
  }

  const accuracyDen = won + lost;
  const accuracyPct =
    accuracyDen > 0 ? Math.round((won / accuracyDen) * 1000) / 10 : null;
  const roiPct =
    settledForRoi > 0
      ? Math.round((profitUnits / settledForRoi) * 1000) / 10
      : null;

  return {
    total,
    won,
    lost,
    voided,
    pending,
    accuracyPct,
    roiPct,
    settledForRoi,
    settledForAccuracy: accuracyDen,
  };
}

export type HistoricEngineMetricsSummary = ReturnType<
  typeof summarizeHistoricEngineMetrics
>;
