import type { OddsApiSimpleEvent } from "@/lib/predictions/odds-api";

/** Normalize pentru potriviri robuste între denumiri API‑Football vs odds‑api. */
export function slugName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, "")
    .trim();
}

function fuzzyPair(aHome: string, aAway: string, bHome: string, bAway: string) {
  const ah = slugName(aHome);
  const aa = slugName(aAway);
  const bh = slugName(bHome);
  const ba = slugName(bAway);
  const sameOrder =
    (ah.includes(bh) || bh.includes(ah)) && (aa.includes(ba) || ba.includes(aa));
  const cross =
    (ah.includes(ba) || ba.includes(ah)) && (aa.includes(bh) || bh.includes(aa));
  return sameOrder || cross;
}

/**
 * Compară ora evenimentului (RFC3339) cu kick‑off fixture (unix sec), toleranță ±6 min.
 */
export function roughlySameKickoff(
  eventIso: string,
  fixtureTsSec: number,
): boolean {
  const ms = Date.parse(eventIso);
  if (!Number.isFinite(ms)) return false;
  const diff = Math.abs(ms - fixtureTsSec * 1000);
  return diff <= 6 * 60 * 1000;
}

export function matchOddsEventToFixture(
  events: OddsApiSimpleEvent[],
  homeName: string,
  awayName: string,
  fixtureTsSec: number,
): OddsApiSimpleEvent | null {
  for (const e of events) {
    if (!roughlySameKickoff(e.date, fixtureTsSec)) continue;
    if (fuzzyPair(homeName, awayName, e.home, e.away)) return e;
  }
  return null;
}
