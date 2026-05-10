/** Convention: suficient `NN` reprezintă linia în zecimi (15 → 1,5 goluri); ex. goals_o25, corners_o115 (11,5 cornere). */

export type TotalsFacet = "goals" | "corners" | "cards" | "fouls";

export function parseTotalsOuMarketId(id: string): null | {
  facet: TotalsFacet;
  over: boolean;
  line: number;
} {
  const m = id.match(/^(goals|corners|cards|fouls)_(o|u)(\d+)$/);
  if (!m) return null;
  const line = parseInt(m[3], 10) / 10;
  if (!Number.isFinite(line) || line < 0) return null;
  return {
    facet: m[1] as TotalsFacet,
    over: m[2] === "o",
    line,
  };
}

export function totalsMarketId(
  facet: TotalsFacet,
  over: boolean,
  line: number,
): string {
  const tenths = Math.round(line * 10);
  return `${facet}_${over ? "o" : "u"}${tenths}`;
}
