import type { OddsApiOddsBody } from "@/lib/predictions/odds-api";
import type { PredictionPick, PredictionPayload } from "@/lib/predictions/types";

const MIN_DECIMAL = 2;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const x = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

type Cand = PredictionPick & { marketKey: string };

function kindOf(c: Cand): "ML" | "OU" | "BTTS" {
  if (c.marketKey === "BTTS") return "BTTS";
  if (c.marketKey.startsWith("OU@")) return "OU";
  return "ML";
}

function flattenCandidates(body: OddsApiOddsBody): Cand[] {
  const out: Cand[] = [];
  const bookmakers = body.bookmakers ?? {};
  for (const markets of Object.values(bookmakers)) {
    if (!Array.isArray(markets)) continue;
    for (const row of markets) {
      const name = row.name?.trim() ?? "";
      if (!name || !Array.isArray(row.odds)) continue;

      if (name === "ML" || /^match winner/i.test(name)) {
        const o = row.odds[0];
        if (!o) continue;
        const h = num(o.home);
        const d = num(o.draw);
        const a = num(o.away);
        if (h != null && h >= MIN_DECIMAL) {
          out.push({
            marketKey: "ML",
            marketLabel: "Rezultat final (1)",
            selection: `${body.home ?? "Gazde"}`,
            decimal: h,
          });
        }
        if (d != null && d >= MIN_DECIMAL) {
          out.push({
            marketKey: "ML",
            marketLabel: "Rezultat final (X)",
            selection: "Egal",
            decimal: d,
          });
        }
        if (a != null && a >= MIN_DECIMAL) {
          out.push({
            marketKey: "ML",
            marketLabel: "Rezultat final (2)",
            selection: `${body.away ?? "Oaspeți"}`,
            decimal: a,
          });
        }
        continue;
      }

      if (/over.?under|^totals?$/i.test(name) || /^o\/?u/i.test(name)) {
        for (const o of row.odds) {
          const lineRaw = typeof o.line === "string" ? o.line : o.max;
          const over = num(o.over);
          const under = num(o.under);
          const lineLabel =
            typeof lineRaw === "number" ? String(lineRaw) : (lineRaw ?? "?");
          if (over != null && over >= MIN_DECIMAL) {
            out.push({
              marketKey: `OU@${lineLabel}`,
              marketLabel: `Goluri - peste ${lineLabel}`,
              selection: `Peste ${lineLabel}`,
              decimal: over,
            });
          }
          if (under != null && under >= MIN_DECIMAL) {
            out.push({
              marketKey: `OU@${lineLabel}`,
              marketLabel: `Goluri - sub ${lineLabel}`,
              selection: `Sub ${lineLabel}`,
              decimal: under,
            });
          }
        }
        continue;
      }

      if (/both teams|\bbtts\b/i.test(name)) {
        const o = row.odds[0];
        if (!o) continue;
        const ys = num(o.yes ?? o.home);
        const no = num(o.no ?? o.away);
        if (ys != null && ys >= MIN_DECIMAL) {
          out.push({
            marketKey: "BTTS",
            marketLabel: "Ambele marchează",
            selection: "Da",
            decimal: ys,
          });
        }
        if (no != null && no >= MIN_DECIMAL) {
          out.push({
            marketKey: "BTTS",
            marketLabel: "Ambele marchează",
            selection: "Nu",
            decimal: no,
          });
        }
      }
    }
  }

  const best = new Map<string, Cand>();
  for (const c of out) {
    const k = `${c.marketKey}:${c.selection}`;
    const cur = best.get(k);
    if (!cur || c.decimal > cur.decimal) best.set(k, c);
  }
  return [...best.values()].sort((a, b) => b.decimal - a.decimal);
}

function confidenceScore(picks: PredictionPick[]): number {
  if (picks.length === 0) return 0;
  const edge = picks.map((p) =>
    Math.min(1, Math.max(0, (p.decimal - MIN_DECIMAL) / 1.25)),
  );
  return edge.reduce((a, b) => a + b, 0) / picks.length;
}

function duplicatePick(
  picks: PredictionPick[],
  label: string,
  sel: string,
): boolean {
  return picks.some((p) => p.marketLabel === label && p.selection === sel);
}

/**
 * Maxim 2 „tipuri” de piețe (ML / OU / BTTS); al treilea rând apare doar dacă încrederea e sub prag
 * sau dacă avem mai puțin de 2 selecții.
 */
export function buildPredictionFromOddsBody(
  body: OddsApiOddsBody,
  oddsApiEventId: number,
): PredictionPayload {
  const cand = flattenCandidates(body);
  const picks: PredictionPick[] = [];
  const usedKinds = new Set<string>();

  for (const c of cand) {
    if (picks.length >= 2) break;
    const k = kindOf(c);
    if (usedKinds.has(k)) continue;
    picks.push({
      marketLabel: c.marketLabel,
      selection: c.selection,
      decimal: Number(c.decimal.toFixed(2)),
    });
    usedKinds.add(k);
  }

  let avg = confidenceScore(picks);
  const LOW = 0.22;

  if ((avg < LOW || picks.length < 2) && picks.length < 3) {
    for (const c of cand) {
      if (duplicatePick(picks, c.marketLabel, c.selection)) continue;
      picks.push({
        marketLabel: c.marketLabel,
        selection: c.selection,
        decimal: Number(c.decimal.toFixed(2)),
      });
      avg = confidenceScore(picks);
      break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    oddsApiEventId,
    picks: picks.slice(0, 3),
    confidenceAvg: Number(avg.toFixed(3)),
  };
}
