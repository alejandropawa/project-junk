import { applyCalibration, buildCalibrationBundle } from "@/lib/probix-evolution/calibration-model";
import { calibrationFamilyKeyFromMarketId } from "@/lib/probix-evolution/market-family";
import type { PickObservation } from "@/lib/probix-evolution/observation-types";
import type { ProbixSelectionModeName } from "@/lib/probix-evolution/selection-profile";
import type {
  FamilyHitSlice,
  PredictionReportLite,
} from "@/lib/probix-evolution/types";

function meanBrier(
  obs: readonly PickObservation[],
  probOf: (o: PickObservation) => number,
): number | null {
  if (obs.length < 8) return null;
  let s = 0;
  for (const o of obs) {
    const p = probOf(o);
    const y = o.won ? 1 : 0;
    const x = Math.min(0.99, Math.max(0.01, p));
    s += (x - y) ** 2;
  }
  return s / obs.length;
}

export function evolutionBrierRaw(
  obs: readonly PickObservation[],
): number | null {
  return meanBrier(obs, (o) => o.modelProb);
}

export function evolutionBrierCalibrated(
  obs: readonly PickObservation[],
): number | null {
  const bundle = buildCalibrationBundle([...obs]);
  if (!bundle.activeGlobal) return null;
  return meanBrier(obs, (o) =>
    applyCalibration(o.modelProb, o.marketId, bundle),
  );
}

/** MAE între prob calibrată și outcome 0/1. */
export function evolutionMeanAbsCalibrationError(
  obs: readonly PickObservation[],
): number | null {
  if (obs.length < 8) return null;
  const bundle = buildCalibrationBundle([...obs]);
  if (!bundle.activeGlobal) return null;
  let s = 0;
  for (const o of obs) {
    const p = applyCalibration(o.modelProb, o.marketId, bundle);
    const y = o.won ? 1 : 0;
    s += Math.abs(p - y);
  }
  return s / obs.length;
}

export function evolutionFamilyHits(
  obs: readonly PickObservation[],
): FamilyHitSlice[] {
  const m = new Map<string, { n: number; w: number }>();
  for (const o of obs) {
    const f = calibrationFamilyKeyFromMarketId(o.marketId);
    if (f === "unknown") continue;
    const cur = m.get(f) ?? { n: 0, w: 0 };
    cur.n += 1;
    if (o.won) cur.w += 1;
    m.set(f, cur);
  }
  return [...m.entries()]
    .map(([family, u]) => ({
      family,
      n: u.n,
      hit: u.n > 0 ? u.w / u.n : 0,
    }))
    .sort((a, b) => b.n - a.n);
}

export type OddsSourceSlice = { n: number; hit: number };

export function evolutionOddsSourcePerformance(
  obs: readonly PickObservation[],
): { bookmaker: OddsSourceSlice; synthetic_fallback: OddsSourceSlice } {
  const book: OddsSourceSlice = { n: 0, hit: 0 };
  const syn: OddsSourceSlice = { n: 0, hit: 0 };
  for (const o of obs) {
    if (o.oddsSource === "synthetic_fallback") {
      syn.n += 1;
      if (o.won) syn.hit += 1;
    } else {
      book.n += 1;
      if (o.won) book.hit += 1;
    }
  }
  const bookHit = book.n > 0 ? book.hit / book.n : 0;
  const synHit = syn.n > 0 ? syn.hit / syn.n : 0;
  return {
    bookmaker: { n: book.n, hit: bookHit },
    synthetic_fallback: { n: syn.n, hit: synHit },
  };
}

export type ComboTypeSlice = { n: number; hit: number };

/**
 * Din rapoarte cu `calibrationOutcome` (nu din observații picior).
 */
export function evolutionComboHitRates(
  rows: readonly PredictionReportLite[],
): {
  single: ComboTypeSlice;
  double: ComboTypeSlice;
  triple: ComboTypeSlice;
} {
  const acc = {
    single: { n: 0, w: 0 },
    double: { n: 0, w: 0 },
    triple: { n: 0, w: 0 },
  };
  for (const row of rows) {
    const ct = row.payload.comboType;
    const out = row.payload.calibrationOutcome;
    if (!ct || !out?.comboResult || out.comboResult === "void") continue;
    const won = out.comboResult === "won" ? 1 : 0;
    if (ct === "single") {
      acc.single.n += 1;
      acc.single.w += won;
    } else if (ct === "double") {
      acc.double.n += 1;
      acc.double.w += won;
    } else if (ct === "triple") {
      acc.triple.n += 1;
      acc.triple.w += won;
    }
  }
  return {
    single: {
      n: acc.single.n,
      hit: acc.single.n > 0 ? acc.single.w / acc.single.n : 0,
    },
    double: {
      n: acc.double.n,
      hit: acc.double.n > 0 ? acc.double.w / acc.double.n : 0,
    },
    triple: {
      n: acc.triple.n,
      hit: acc.triple.n > 0 ? acc.triple.w / acc.triple.n : 0,
    },
  };
}

const MODE_ENV_ALIASES: Record<string, ProbixSelectionModeName> = {
  hit_rate: "hit_rate",
  hit_rate_first: "hit_rate",
  balanced: "balanced",
  conservative: "conservative",
  value: "value",
  edge: "value",
  aggressive: "value",
};

/** Apoximare: dacă raportul nu persistă modul, folosim env curent. */
export function evolutionEffectiveSelectionModeFromEnv(): ProbixSelectionModeName {
  const m = (process.env.PROBIX_SELECTION_MODE ?? "balanced")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return MODE_ENV_ALIASES[m] ?? "balanced";
}
