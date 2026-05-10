/**
 * O combinație nu poate include două selecții din același tip de „piață”
 * (ex. peste 1.5 goluri și peste 2.5 goluri).
 */
export const EXCLUSIVE_TOTAL_GOALS_LINE_BUCKET = "__total_goals_threshold__";

export const EXCLUSIVE_CORNERS_OVER_BUCKET = "__corners_over_threshold__";

export const EXCLUSIVE_CARDS_OVER_BUCKET = "__cards_over_threshold__";

export function marketExclusivityBucket(marketId: string): string | null {
  switch (marketId) {
    case "goals_o15":
    case "goals_o25":
    case "goals_u25":
      return EXCLUSIVE_TOTAL_GOALS_LINE_BUCKET;
    case "corners_o85":
    case "corners_o95":
      return EXCLUSIVE_CORNERS_OVER_BUCKET;
    case "cards_o35":
    case "cards_o45":
      return EXCLUSIVE_CARDS_OVER_BUCKET;
    default:
      return null;
  }
}

/** True dacă `candidate` este în conflict cu cel puțin un picior din `chosen`. */
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

/**
 * Fallback dur: păstrează ordinea și elimină dubluri (același `marketId`) sau
 * selecții din același bucket exclusiv (ex. două linii de goluri totale).
 */
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
