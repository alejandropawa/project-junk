import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import { totalsMarketId } from "@/lib/probix-engine/total-market-id";

/**
 * Multiplicator latent de „stabilitate” pentru reducerea varianței la selecție.
 * >1 = piețe previzibile; <1 = haotice / zgomotoase în practică.
 * Combină profil facet + linii agresive (safe-line bias).
 */

const EXPLICIT = new Map<string, number>();

function put(id: string, v: number) {
  EXPLICIT.set(id, v);
}

// Goluri — relativ stabile
put(totalsMarketId("goals", true, 0.5), 1.04);
put(totalsMarketId("goals", true, 1.5), 1.22);
put(totalsMarketId("goals", true, 2.5), 1.08);
put(totalsMarketId("goals", false, 2.5), 1.1);
put(totalsMarketId("goals", false, 3.5), 1.06);
put(totalsMarketId("goals", false, 4.5), 1.03);
put(totalsMarketId("goals", true, 3.5), 0.93);
put(totalsMarketId("goals", true, 4.5), 0.87);
put(totalsMarketId("goals", false, 1.5), 0.95);
put(totalsMarketId("goals", false, 0.5), 0.82);

put("dc_1x", 1.16);
put("dc_x2", 1.12);
put("dc_12", 1.0);

put("btts_yes", 0.97);
put("btts_no", 1.02);

// Cornere — volatili
for (const ln of [6.5, 7.5]) {
  put(totalsMarketId("corners", false, ln), 0.86);
}
put(totalsMarketId("corners", false, 8.5), 0.92);
put(totalsMarketId("corners", true, 8.5), 1.02);
put(totalsMarketId("corners", true, 9.5), 0.93);
put(totalsMarketId("corners", false, 9.5), 0.9);
put(totalsMarketId("corners", true, 10.5), 0.82);
put(totalsMarketId("corners", true, 11.5), 0.76);
put(totalsMarketId("corners", false, 10.5), 0.88);
put(totalsMarketId("corners", false, 11.5), 0.82);

for (const ln of [2.5]) {
  put(totalsMarketId("cards", false, ln), 0.88);
}
put(totalsMarketId("cards", true, 3.5), 0.76);
put(totalsMarketId("cards", true, 4.5), 0.72);
put(totalsMarketId("cards", true, 5.5), 0.67);
for (const ln of [5.5, 4.5]) {
  put(totalsMarketId("cards", false, ln), 0.78);
}

for (const ln of [18.5, 20.5]) {
  put(totalsMarketId("fouls", true, ln), 0.78);
}
put(totalsMarketId("fouls", true, 26.5), 0.7);
put(totalsMarketId("fouls", true, 28.5), 0.66);

export function getMarketStabilityMultiplier(marketId: string): number {
  if (EXPLICIT.has(marketId)) return EXPLICIT.get(marketId)!;

  const spec = parseTotalsOuMarketId(marketId);
  if (!spec) return 1;

  /** Safe-line fallback per facet dacă lipsesc mapping exacte */
  switch (spec.facet) {
    case "goals":
      if (spec.over && spec.line >= 4) return 0.9;
      if (spec.over && spec.line <= 2.5) return 1.05;
      if (!spec.over && spec.line <= 3.5 && spec.line >= 2.5) return 1.05;
      if (!spec.over && spec.line <= 1.5) return 0.92;
      return 1;
    case "corners":
      if (spec.over && spec.line >= 10.5) return 0.8;
      if (spec.over && spec.line <= 9.5) return 0.95;
      return 0.9;
    case "cards":
      return spec.over ? 0.73 : 0.8;
    case "fouls":
      return spec.over && spec.line >= 24.5 ? 0.68 : 0.76;
    default:
      return 1;
  }
}
