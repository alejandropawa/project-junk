/**
 * O combinație: maximum o piață din fiecare familie (goluri total, cornere, cartonașe,
 * faulturi, șanse duble, BTTS).
 */

export const EXCLUSIVE_TOTAL_GOALS_LINE_BUCKET = "__total_goals_threshold__";

export const EXCLUSIVE_CORNERS_TOTAL_BUCKET = "__corners_total_threshold__";

export const EXCLUSIVE_CARDS_TOTAL_BUCKET = "__cards_total_threshold__";

export const EXCLUSIVE_FOULS_TOTAL_BUCKET = "__fouls_total_threshold__";

export const EXCLUSIVE_DOUBLE_CHANCE_BUCKET = "__double_chance__";

export const EXCLUSIVE_BTTS_BUCKET = "__btts_yes_no__";

export function marketExclusivityBucket(marketId: string): string | null {
  if (marketId.startsWith("goals_")) return EXCLUSIVE_TOTAL_GOALS_LINE_BUCKET;
  if (marketId.startsWith("corners_")) return EXCLUSIVE_CORNERS_TOTAL_BUCKET;
  if (marketId.startsWith("cards_")) return EXCLUSIVE_CARDS_TOTAL_BUCKET;
  if (marketId.startsWith("fouls_")) return EXCLUSIVE_FOULS_TOTAL_BUCKET;
  if (marketId.startsWith("dc_")) return EXCLUSIVE_DOUBLE_CHANCE_BUCKET;
  if (marketId.startsWith("btts_")) return EXCLUSIVE_BTTS_BUCKET;
  return null;
}

export function exclusiveMarketConflict(
  candidateMarketId: string,
  chosen: { marketId: string }[],
): boolean {
  const b = marketExclusivityBucket(candidateMarketId);
  if (b == null) return false;
  return chosen.some(
    (x) => marketExclusivityBucket(x.marketId) === b,
  );
}

export function dedupeExclusiveMarketOrder<T extends { marketId?: string }>(
  picks: readonly T[],
): T[] {
  const seenMarketId = new Set<string>();
  const seenBucket = new Set<string>();

  const out: T[] = [];
  for (const p of picks) {
    const mid = typeof p.marketId === "string" ? p.marketId.trim() : "";
    if (!mid) {
      out.push(p);
      continue;
    }
    if (seenMarketId.has(mid)) continue;

    const bucket = marketExclusivityBucket(mid);
    if (bucket != null && seenBucket.has(bucket)) continue;

    seenMarketId.add(mid);
    if (bucket != null) seenBucket.add(bucket);
    out.push(p);
  }
  return out;
}
