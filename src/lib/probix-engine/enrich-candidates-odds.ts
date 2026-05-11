import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import { totalsMarketId } from "@/lib/probix-engine/total-market-id";
import type { MarketCandidate, OddsSource } from "@/lib/probix-engine/types";

export function correlationTagsForMarketId(marketId: string): string[] {
  const tags: string[] = [];
  if (marketId.startsWith("goals_o")) tags.push("goals_over");
  else if (marketId.startsWith("goals_u")) tags.push("goals_under");
  if (marketId.startsWith("corners_o")) tags.push("corners_over");
  else if (marketId.startsWith("corners_u")) tags.push("corners_under");
  if (marketId.startsWith("cards_o")) tags.push("cards_over");
  else if (marketId.startsWith("cards_u")) tags.push("cards_under");
  if (marketId.startsWith("fouls_o")) tags.push("fouls_over");
  else if (marketId.startsWith("fouls_u")) tags.push("fouls_under");
  if (marketId === "btts_yes") tags.push("btts_yes");
  if (marketId === "btts_no") tags.push("btts_no");
  if (marketId.startsWith("dc_")) tags.push("double_chance", marketId);
  return tags;
}

/** Bonus mic pentru linii considerate mai „sigure” pentru calibrare. */
export function marketPreferenceBoost(marketId: string): number {
  if (marketId === totalsMarketId("goals", true, 1.5)) return 0.11;
  if (marketId.startsWith("dc_")) return 0.09;

  const spec = parseTotalsOuMarketId(marketId);
  if (!spec) return 0;

  if (spec.facet === "corners" && spec.line >= 8.5 && spec.line <= 10.5)
    return 0.065;
  if (spec.facet === "cards" && spec.line >= 3.5 && spec.line <= 4.5)
    return 0.055;
  if (
    spec.facet === "goals" &&
    !spec.over &&
    spec.line >= 2.5 &&
    spec.line <= 3.5
  )
    return 0.04;
  return 0;
}

/** Penalizare piețe agresive / cozi probabilitate joasă. */
export function marketAggressionPenalty(marketId: string): number {
  const spec = parseTotalsOuMarketId(marketId);
  if (!spec) {
    if (marketId === "btts_yes" || marketId === "dc_12") return 0.06;
    return 0;
  }
  let pen = 0;
  if (spec.facet === "goals" && spec.over && spec.line >= 3.5) pen += 0.09;
  if (spec.facet === "goals" && !spec.over && spec.line <= 1.5) pen += 0.07;
  if (spec.facet === "corners" && spec.over && spec.line >= 10.5) pen += 0.08;
  if (spec.facet === "corners" && !spec.over && spec.line <= 7.5) pen += 0.07;
  if (spec.facet === "cards" && spec.over && spec.line >= 5.5) pen += 0.08;
  if (spec.facet === "fouls" && spec.over && spec.line >= 26.5) pen += 0.07;
  return pen;
}

export function enrichCandidatesWithBookmakerDecimals(
  candidates: readonly MarketCandidate[],
  oddsByMarketId: ReadonlyMap<string, number> | undefined,
  oddsMin: number,
  oddsMax: number,
): MarketCandidate[] {
  const out: MarketCandidate[] = [];
  for (const c of candidates) {
    const raw = oddsByMarketId?.get(c.marketId);
    if (
      raw != null &&
      Number.isFinite(raw) &&
      (raw < oddsMin || raw > oddsMax)
    ) {
      continue;
    }

    let bookD: number;
    let source: OddsSource;
    if (raw != null && Number.isFinite(raw) && raw >= oddsMin && raw <= oddsMax) {
      bookD = Number(Number(raw).toFixed(3));
      source = "bookmaker";
    } else {
      bookD = c.estimatedDecimal;
      source = "synthetic_fallback";
    }

    const implied = 1 / bookD;
    const edge = source === "bookmaker" ? c.p - implied : 0;

    out.push({
      ...c,
      bookmakerDecimal: bookD,
      bookmakerImpliedProb: implied,
      edgeScore: edge,
      oddsSource: source,
      correlationTags: correlationTagsForMarketId(c.marketId),
    });
  }
  return out;
}
