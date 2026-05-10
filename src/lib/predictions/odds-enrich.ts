import type {
  OddsApiOddsBody,
  OddsMarketOdds,
  OddsMarketRow,
} from "@/lib/predictions/odds-api";
import type { PredictionPayload, PredictionPick } from "@/lib/predictions/types";

/** Market IDs emise de motorul Probix (pot fi mapate către Odds API). */
const PROBIX_MARKET_IDS = new Set([
  "goals_o15",
  "goals_o25",
  "goals_u25",
  "btts_yes",
  "corners_o95",
  "corners_o85",
  "cards_o35",
  "dc_1x",
]);

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

/** Găsește rândurile pentru un operator (Odds API poate avea casă diferite). */
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
        }
      }
      continue;
    }

    if (!isCorners && !isCards && /both.?teams|\bbtts\b/i.test(name)) {
      for (const cell of row.odds as OddsMarketOdds[]) {
        const ys = num(cell.yes ?? cell.home);
        if (ys != null && ys >= 1.01) add(out, "btts_yes", ys);
      }
      continue;
    }

    const looksOuTotals =
      /over.?under|^totals?$|^ou\b|^goals?$/i.test(name) || /^o\/?u/i.test(name);

    if (looksOuTotals || (isCorners && /over|under|total|\d/i.test(name)) || (isCards && /over|under|total|\d/i.test(name))) {
      for (const cell of row.odds as OddsMarketOdds[]) {
        const lineNorm =
          normalizeOuLine(cell.line) ??
          normalizeOuLine(cell.max) ??
          normalizeOuLine(cell.handicap);
        const over = num(cell.over);
        const under = num(cell.under);
        if (lineNorm == null) continue;

        if (over != null && over >= 1.01) {
          if (isCorners) {
            if (lineNorm === 9.5) add(out, "corners_o95", over);
            if (lineNorm === 8.5) add(out, "corners_o85", over);
          } else if (isCards) {
            if (lineNorm === 3.5) add(out, "cards_o35", over);
          } else {
            if (lineNorm === 1.5) add(out, "goals_o15", over);
            if (lineNorm === 2.5) add(out, "goals_o25", over);
          }
        }
        if (under != null && under >= 1.01 && !isCorners && !isCards) {
          if (lineNorm === 2.5) add(out, "goals_u25", under);
        }
      }
    }
  }

  return out;
}

/** Mediană pe fiecare operator listat în CSV; apoi mediană între operatori dacă avem mai multe valori. */
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

/** Suprascrie cote cu snapshot Odds API când există potrivire; recalculează produsul. */
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
