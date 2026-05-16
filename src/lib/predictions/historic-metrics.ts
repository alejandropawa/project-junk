import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import { calibrationFamilyKeyFromMarketId } from "@/lib/probix-evolution/market-family";
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

type RoiBucket = {
  key: string;
  bets: number;
  won: number;
  lost: number;
  profitUnits: number;
  roiPct: number | null;
};

function oddsBucket(decimal: number | null): string {
  if (decimal == null || !Number.isFinite(decimal)) return "unknown";
  if (decimal < 1.5) return "<1.50";
  if (decimal < 2) return "1.50-1.99";
  if (decimal < 2.5) return "2.00-2.49";
  if (decimal < 3) return "2.50-2.99";
  return "3.00+";
}

function addRoiBucket(map: Map<string, RoiBucket>, key: string, settlement: PredictionSettlement, decimal: number | null) {
  if (settlement !== "won" && settlement !== "lost") return;
  const cur = map.get(key) ?? {
    key,
    bets: 0,
    won: 0,
    lost: 0,
    profitUnits: 0,
    roiPct: null,
  };
  cur.bets += 1;
  if (settlement === "won") {
    cur.won += 1;
    cur.profitUnits += decimal != null && decimal > 1 ? decimal - 1 : 0;
  } else {
    cur.lost += 1;
    cur.profitUnits -= 1;
  }
  map.set(key, cur);
}

function finalizeBuckets(map: Map<string, RoiBucket>): RoiBucket[] {
  return [...map.values()]
    .map((row) => ({
      ...row,
      profitUnits: Math.round(row.profitUnits * 1000) / 1000,
      roiPct: row.bets > 0 ? Math.round((row.profitUnits / row.bets) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.bets - a.bets);
}

export function summarizeValueRoiBreakdowns(payloads: PredictionPayload[]) {
  const byMarketFamily = new Map<string, RoiBucket>();
  const byLeague = new Map<string, RoiBucket>();
  const byOddsBucket = new Map<string, RoiBucket>();
  const byComboType = new Map<string, RoiBucket>();
  const byPredictionSource = new Map<string, RoiBucket>();

  for (const p of payloads) {
    const settlement = settlementOf(p);
    if (settlement !== "won" && settlement !== "lost") continue;
    const dec = combinedDecimalForRoi(p);
    const family =
      p.picks?.[0]?.marketId != null
        ? calibrationFamilyKeyFromMarketId(p.picks[0].marketId)
        : "unknown";
    addRoiBucket(byMarketFamily, family, settlement, dec);
    addRoiBucket(byLeague, p.calibrationSnapshot?.leagueName ?? "unknown", settlement, dec);
    addRoiBucket(byOddsBucket, oddsBucket(dec), settlement, dec);
    addRoiBucket(byComboType, p.comboType ?? "unknown", settlement, dec);
    addRoiBucket(
      byPredictionSource,
      p.picks?.some((pick) => pick.oddsSource === "bookmaker")
        ? "bookmaker"
        : "synthetic_fallback",
      settlement,
      dec,
    );
  }

  return {
    byMarketFamily: finalizeBuckets(byMarketFamily),
    byLeague: finalizeBuckets(byLeague),
    byOddsBucket: finalizeBuckets(byOddsBucket),
    byComboType: finalizeBuckets(byComboType),
    byPredictionSource: finalizeBuckets(byPredictionSource),
  };
}
