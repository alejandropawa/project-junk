import type {
  OddsApiOddsBody,
  OddsMarketOdds,
  OddsMarketRow,
} from "@/lib/predictions/odds-api";
import type { PredictionPayload, PredictionPick } from "@/lib/predictions/types";
import type { TotalsFacet } from "@/lib/probix-engine/total-market-id";
import { totalsMarketId } from "@/lib/probix-engine/total-market-id";

/** IDs cunoscute emise de motor Probix — folosit la extragerea cotelor din Odds API. */
function probixAnchoredMarketIds(): Set<string> {
  const s = new Set<string>();
  for (const ln of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    s.add(totalsMarketId("goals", true, ln));
    s.add(totalsMarketId("goals", false, ln));
  }
  for (const ln of [6.5, 7.5, 8.5, 9.5, 10.5, 11.5]) {
    s.add(totalsMarketId("corners", true, ln));
    s.add(totalsMarketId("corners", false, ln));
  }
  for (const ln of [2.5, 3.5, 4.5, 5.5]) {
    s.add(totalsMarketId("cards", true, ln));
    s.add(totalsMarketId("cards", false, ln));
  }
  for (const ln of [18.5, 20.5, 22.5, 24.5, 26.5, 28.5]) {
    s.add(totalsMarketId("fouls", true, ln));
    s.add(totalsMarketId("fouls", false, ln));
  }
  s.add("btts_yes");
  s.add("btts_no");
  s.add("dc_1x");
  s.add("dc_x2");
  s.add("dc_12");
  return s;
}

const PROBIX_MARKET_IDS = probixAnchoredMarketIds();

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const x = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function normalizeOuLine(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const x = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function bookmakerRows(
  body: OddsApiOddsBody,
  bookmakerCsvName: string,
): OddsMarketRow[] | undefined {
  const bm = body.bookmakers ?? {};
  if (!bookmakerCsvName) return undefined;
  if (bm[bookmakerCsvName]) return bm[bookmakerCsvName];
  const k = Object.keys(bm).find(
    (x) => x.toLowerCase() === bookmakerCsvName.toLowerCase(),
  );
  return k ? bm[k] : undefined;
}

function addOuIfKnown(
  out: Map<string, number[]>,
  facet: TotalsFacet,
  over: boolean,
  lineValue: number,
  d: number,
): void {
  if (d < 1.01) return;
  const id = totalsMarketId(facet, over, lineValue);
  if (!PROBIX_MARKET_IDS.has(id)) return;
  const arr = out.get(id) ?? [];
  arr.push(d);
  out.set(id, arr);
}

/** Extrage către fiecare `marketId` Probix lista de cote dintr-un singur bookmaker. */
function parseProbixAnchorsFromMarkets(markets: OddsMarketRow[]): Map<string, number[]> {
  const add = (m: Map<string, number[]>, id: string, d: number) => {
    if (!PROBIX_MARKET_IDS.has(id)) return;
    const arr = m.get(id) ?? [];
    arr.push(d);
    m.set(id, arr);
  };
  const out = new Map<string, number[]>();

  for (const row of markets) {
    const name = row.name?.trim() ?? "";
    if (!name || !Array.isArray(row.odds)) continue;

    const isCorners = /corner|corners/i.test(name);
    const isCards =
      /\bcards?\b|booking|yellow|carton/i.test(name) && !isCorners;
    const isFouls =
      /\bfouls?\b|\bfaults?\b/i.test(name) &&
      !isCorners &&
      !isCards;

    if (/double.?chance|\bdc\b|^dc$/i.test(name)) {
      for (const cell of row.odds as OddsMarketOdds[]) {
        for (const [k, raw] of Object.entries(cell)) {
          const kl = k.toLowerCase().replace(/\s+/g, "");
          const d = num(raw);
          if (d == null || d < 1.01) continue;
          if (
            kl === "1x" ||
            kl.includes("homordraw") ||
            kl.includes("1orx") ||
            (kl.includes("home") && kl.includes("draw"))
          ) {
            add(out, "dc_1x", d);
          }
          if (
            kl === "x2" ||
            kl.includes("drawaway") ||
            kl.includes("drawora") ||
            kl === "x2"
          ) {
            add(out, "dc_x2", d);
          }
          if (
            kl === "12" ||
            kl.includes("homeoraway") ||
            kl.includes("1or2") ||
            (kl.includes("home") && kl.includes("away") && !kl.includes("draw"))
          ) {
            add(out, "dc_12", d);
          }
        }
      }
      continue;
    }

    if (!isCorners && !isCards && /both.?teams|\bbtts\b/i.test(name)) {
      for (const cell of row.odds as OddsMarketOdds[]) {
        const ys = num(cell.yes ?? cell.home);
        if (ys != null && ys >= 1.01) add(out, "btts_yes", ys);
        const no = num(cell.no ?? cell.away);
        if (no != null && no >= 1.01) add(out, "btts_no", no);
      }
      continue;
    }

    const looksOuTotals =
      /over.?under|^totals?$|^ou\b|^goals?$/i.test(name) || /^o\/?u/i.test(name);

    if (
      looksOuTotals ||
      (isCorners && /over|under|total|\d/i.test(name)) ||
      (isCards && /over|under|total|\d/i.test(name)) ||
      (isFouls && /over|under|total|\d/i.test(name))
    ) {
      for (const cell of row.odds as OddsMarketOdds[]) {
        const lineNorm =
          normalizeOuLine(cell.line) ??
          normalizeOuLine(cell.max) ??
          normalizeOuLine(cell.handicap);
        const overD = num(cell.over);
        const underD = num(cell.under);
        if (lineNorm == null || !Number.isFinite(lineNorm)) continue;

        const facet: TotalsFacet = isCorners
          ? "corners"
          : isCards
            ? "cards"
            : isFouls
              ? "fouls"
              : "goals";

        if (overD != null) addOuIfKnown(out, facet, true, lineNorm, overD);
        if (underD != null) addOuIfKnown(out, facet, false, lineNorm, underD);
      }
    }
  }

  return out;
}

function decimalsPerMarketAcrossBookmakers(
  body: OddsApiOddsBody,
  bookmakersCsv: string,
): Map<string, number> {
  const names = bookmakersCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new Map<string, number>();
  const perMid = new Map<string, number[]>();

  for (const bk of names) {
    const rows = bookmakerRows(body, bk);
    if (!rows?.length) continue;
    const m = parseProbixAnchorsFromMarkets(rows);
    for (const [mid, decimals] of m) {
      const oneBk = median(decimals);
      if (oneBk == null) continue;
      const acc = perMid.get(mid) ?? [];
      acc.push(oneBk);
      perMid.set(mid, acc);
    }
  }

  for (const [mid, arr] of perMid) {
    const med = median(arr);
    if (med != null) out.set(mid, Number(med.toFixed(3)));
  }
  return out;
}

export function enrichPayloadWithOddsSnapshot(
  payload: PredictionPayload,
  body: OddsApiOddsBody | null | undefined,
  bookmakersCsv: string,
): PredictionPayload {
  if (!body?.bookmakers || !payload.picks.length) return payload;

  const fromApi = decimalsPerMarketAcrossBookmakers(body, bookmakersCsv);
  if (!fromApi.size) return payload;

  const nextPicks: PredictionPick[] = payload.picks.map((p) => {
    const mid = p.marketId;
    if (!mid) return p;
    const d = fromApi.get(mid);
    if (d == null || !(d >= 1.01)) return p;
    return {
      ...p,
      decimal: Number(Number(d).toFixed(2)),
    };
  });

  const touched = nextPicks.some(
    (p, i) => p.decimal !== payload.picks[i]?.decimal,
  );
  if (!touched) return payload;

  const combined = Math.min(
    80,
    Math.max(1.05, nextPicks.reduce((m, q) => m * q.decimal, 1)),
  );
  const rounded = Number(combined.toFixed(2));

  return {
    ...payload,
    picks: nextPicks,
    estimatedCombinedDecimal: rounded,
  };
}
