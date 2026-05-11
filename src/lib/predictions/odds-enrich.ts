import type { OddsApiOddsBody } from "@/lib/predictions/odds-api";
import { decimalsPerMarketAcrossBookmakers } from "@/lib/predictions/odds-probix-map";
import type { PredictionPayload, PredictionPick } from "@/lib/predictions/types";

/**
 * Înlocuiește cotele salvate dacă rulăm din nou contra Odds API (ex. ingest tardiv).
 * Motorul Probix folosește deja aceeași mapare la selecție; acest strat rămâne pentru compat.
 */
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
