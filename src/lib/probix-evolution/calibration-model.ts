/**
 * Izotonic regression după binning (PAV pe medii de bucket) — stabil la eșantion mare.
 */

import {
  calibrationFamilyKeyFromMarketId,
  type CalibrationFamilyKey,
} from "@/lib/probix-evolution/market-family";
import type { PickObservation } from "@/lib/probix-evolution/types";

export const CALIBRATION_MIN_SAMPLES_GLOBAL = 500;

export const CALIBRATION_MIN_SAMPLES_FAMILY = 180;

/** Număr de bucket-e sortate pe prob model. */
const ISO_BINS = 28;

/** PAV 1D — medii monoton crescătoare (Pool Adjacent Violators). */
function pavIncreasing(y: readonly number[]): number[] {
  const blocks = y.map((v) => ({ av: v, w: 1 }));
  let i = 0;
  while (i < blocks.length) {
    if (i === 0 || blocks[i - 1].av <= blocks[i].av) {
      i += 1;
    } else {
      const a = blocks[i - 1];
      const b = blocks[i];
      const nw = a.w + b.w;
      const nv = (a.av * a.w + b.av * b.w) / nw;
      blocks[i - 1] = { av: nv, w: nw };
      blocks.splice(i, 1);
      i = Math.max(0, i - 1);
    }
  }
  const out: number[] = [];
  for (const bl of blocks) {
    for (let k = 0; k < bl.w; k++) out.push(bl.av);
  }
  return out;
}

function buildLinearInterp(
  knots: readonly number[],
  values: readonly number[],
): (p: number) => number {
  if (!knots.length) return (p) => p;
  const k0 = knots[0];
  const kLast = knots[knots.length - 1];
  return (q: number) => {
    let x = Number.isFinite(q) ? q : 0.5;
    x = Math.min(0.982, Math.max(0.015, x));
    if (x <= k0 + 1e-9) return values[0];
    if (x >= kLast - 1e-9) return values[values.length - 1];
    let lo = 0;
    let hi = knots.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (knots[mid] <= x) lo = mid;
      else hi = mid;
    }
    const t =
      (x - knots[lo]) /
      Math.max(1e-9, knots[hi] - knots[lo]);
    return Math.min(
      0.965,
      Math.max(0.03, values[lo] + t * (values[hi] - values[lo])),
    );
  };
}

function fitBinnedIsotonic(
  obs: readonly PickObservation[],
  minSamples = CALIBRATION_MIN_SAMPLES_GLOBAL,
): ((p: number) => number) | null {
  if (obs.length < minSamples) return null;
  const sorted = [...obs].sort((a, b) => a.modelProb - b.modelProb);
  const chunk = Math.max(10, Math.ceil(sorted.length / ISO_BINS));
  const bx: number[] = [];
  const by: number[] = [];
  for (let i = 0; i < sorted.length; i += chunk) {
    const sl = sorted.slice(i, i + chunk);
    bx.push(sl.reduce((s, x) => s + x.modelProb, 0) / sl.length);
    by.push(sl.filter((x) => x.won).length / sl.length);
  }
  const isoY = pavIncreasing(by);
  return buildLinearInterp(bx, isoY);
}

export type CalibrationBundle = {
  global: ((p: number) => number) | null;
  byFamily: ReadonlyMap<CalibrationFamilyKey, (p: number) => number>;
  usedSamples: number;
  activeGlobal: boolean;
};

export function inactiveCalibrationBundle(): CalibrationBundle {
  return {
    global: null,
    byFamily: new Map(),
    usedSamples: 0,
    activeGlobal: false,
  };
}

export function buildCalibrationBundle(obs: PickObservation[]): CalibrationBundle {
  const global = fitBinnedIsotonic(obs, CALIBRATION_MIN_SAMPLES_GLOBAL);
  const byFam = new Map<CalibrationFamilyKey, (p: number) => number>();
  if (!global) {
    return {
      global: null,
      byFamily: byFam,
      usedSamples: obs.length,
      activeGlobal: false,
    };
  }

  const groups = new Map<CalibrationFamilyKey, PickObservation[]>();
  for (const o of obs) {
    const f = calibrationFamilyKeyFromMarketId(o.marketId);
    if (f === "unknown") continue;
    const arr = groups.get(f) ?? [];
    arr.push(o);
    groups.set(f, arr);
  }
  for (const [fam, slice] of groups) {
    if (slice.length < CALIBRATION_MIN_SAMPLES_FAMILY) continue;
    const f = fitBinnedIsotonic(slice, CALIBRATION_MIN_SAMPLES_FAMILY);
    if (f) byFam.set(fam, f);
  }

  return {
    global,
    byFamily: byFam,
    usedSamples: obs.length,
    activeGlobal: true,
  };
}

export function applyCalibration(
  rawP: number,
  marketId: string,
  bundle: CalibrationBundle | null | undefined,
): number {
  if (!bundle?.activeGlobal || !bundle.global) return rawP;
  const fam = calibrationFamilyKeyFromMarketId(marketId);
  const fn = bundle.byFamily.get(fam) ?? bundle.global;
  try {
    return fn(rawP);
  } catch {
    return rawP;
  }
}
