import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import type { MarketCandidate } from "@/lib/probix-engine/types";
import type { ProbixSelectionModeName } from "@/lib/probix-evolution/selection-profile";

/** Moduri care permit întregul grafd de candidați (~value / aggressive). */
const UNRESTRICTED: ProbixSelectionModeName[] = ["value"];

function parseMode(m: ProbixSelectionModeName): ProbixSelectionModeName {
  return UNRESTRICTED.includes(m) ? m : (m === "conservative" ? "conservative" : m);
}

function cornerMaxOverLine(marketId: string): number | null {
  const s = parseTotalsOuMarketId(marketId);
  if (!s || s.facet !== "corners" || !s.over) return null;
  return s.line;
}

function isExtremeTotals(marketId: string): boolean {
  const s = parseTotalsOuMarketId(marketId);
  if (!s) return false;
  if (s.facet === "goals") {
    if (s.over && s.line >= 4.5) return true;
    if (!s.over && s.line <= 0.5 + 1e-9) return true;
    return false;
  }
  if (s.facet === "corners") {
    if (s.over && s.line >= 11.5 - 1e-9) return true;
    if (!s.over && s.line <= 6.5) return true;
    return false;
  }
  if (s.facet === "cards") {
    return (s.over && s.line >= 5.5 - 1e-9) || (!s.over && s.line <= 2.5);
  }
  if (s.facet === "fouls") {
    return (s.over && s.line >= 26.5 - 1e-9) || (!s.over && s.line <= 18.5);
  }
  return false;
}

/**
 * Hit-rate și conservative: restrâng candidații volatili / agresivi.
 */
export function filterCandidatesForSelectionPolicy(
  candidates: MarketCandidate[],
  mode: ProbixSelectionModeName,
): MarketCandidate[] {
  const m = parseMode(mode);
  const isHit = mode === "hit_rate" || (mode as string) === "hit_rate_first";

  let out = candidates;

  /** hit_rate strict */
  if (isHit) {
    out = out.filter((c) => !c.marketId.startsWith("fouls_"));
    out = out.filter((c) => !c.marketId.startsWith("cards_"));
    out = out.filter((c) => {
      if (!c.marketId.startsWith("corners_")) return true;
      const mx = cornerMaxOverLine(c.marketId);
      if (mx != null && mx > 9.5 + 1e-9) return false;
      const s = parseTotalsOuMarketId(c.marketId);
      if (s?.facet === "corners" && !s.over && s.line <= 7.5 + 1e-9) return false;
      return true;
    });
    out = out.filter((c) => {
      if (c.oddsSource === "synthetic_fallback") return true;
      return (c.bookmakerDecimal ?? 0) <= 2.25 + 1e-9;
    });
    out = out.filter((c) => !isExtremeTotals(c.marketId));
  }

  /** conservative — păstrează un spectru intermediar */
  if (m === "conservative" && !isHit) {
    out = out.filter((c) => !isExtremeTotals(c.marketId));
  }

  /** balanced: doar extreme cozi */
  if (m === "balanced") {
    out = out.filter((c) => !isExtremeTotals(c.marketId));
  }

  return out.length ? out : candidates;
}

/**
 * În hit_rate, tripla doar dacă toate picioarele sunt agent + edge suficient + fără synthetic.
 */
export function hitRateTripleAllowed(
  legs: MarketCandidate[],
  minEdgeLeg: number,
): boolean {
  if (
    legs.length !== 3 ||
    legs.some((x) => x.oddsSource !== "bookmaker")
  )
    return false;
  const prod = legs.reduce((m, x) => m * x.p, 1);
  if (prod < 0.53) return false;
  return legs.every(
    (x) => typeof x.edgeScore === "number" && x.edgeScore >= minEdgeLeg,
  );
}
