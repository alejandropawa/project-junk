import type { PredictionPick } from "@/lib/predictions/types";

/** Produs cotă pentru afișare „combinată”; nu implică evenimente independente. */
export function combinedDecimalFromPicks(picks: PredictionPick[]): number | null {
  if (!picks.length) return null;
  let p = 1;
  let n = 0;
  for (const x of picks) {
    if (!Number.isFinite(x.decimal) || x.decimal <= 1) continue;
    p *= x.decimal;
    n += 1;
  }
  if (n === 0) return null;
  return Number(p.toFixed(2));
}
