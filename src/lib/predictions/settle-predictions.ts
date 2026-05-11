import {
  deriveComboVisualSettlement,
  evaluatePickResult,
} from "@/lib/predictions/pick-result";
import type { PredictionPayload } from "@/lib/predictions/types";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import { enrichFixturesWithLiveStatistics } from "@/lib/football-api/enrich-fixtures-live-statistics";
import { normalizeFixtureRow } from "@/lib/football-api/normalize-fixture-row";
import type { ApiFixtureRow } from "@/lib/football-api/types";
import { parseApiResponse } from "@/lib/football-api/types";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { hasRealFootballApiErrors } from "@/lib/football-api/response-errors";
import { liveTotalsFromFixture } from "@/lib/football-api/fixture-live-stats";

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

const FETCH_CHUNK = 20;

/** Actualizează `settlement` pe payload când combinația e decisă la status final din API. */
export function mergedPayloadWithSettlement(
  nf: NormalizedFixture,
  payload: PredictionPayload,
): PredictionPayload | null {
  if (isPredictionCombinationResolved(payload)) return null;
  if (!payload.picks?.length) return null;
  if (nf.bucket !== "finished") return null;

  const totals = liveTotalsFromFixture(nf);
  const derived = deriveComboVisualSettlement(
    nf,
    payload.picks,
    payload.settlement,
    totals,
  );
  if (derived === "pending") return null;

  const pickResults = payload.picks.map((pick) => ({
    marketId: pick.marketId,
    result: evaluatePickResult(nf, pick, totals),
  }));

  return {
    ...payload,
    settlement: derived,
    calibrationOutcome: {
      settledAt: new Date().toISOString(),
      comboResult: derived,
      pickResults,
    },
  };
}

export async function fetchNormalizedFixturesByIds(
  ids: readonly number[],
  apiKey: string,
): Promise<Map<number, NormalizedFixture>> {
  const headers = { "x-apisports-key": apiKey };
  const out = new Map<number, NormalizedFixture>();

  for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
    const slice = ids.slice(i, i + FETCH_CHUNK).filter((n) => n > 0);
    if (!slice.length) continue;

    const url = new URL("/fixtures", API_BASE);
    url.searchParams.set("ids", slice.join("-"));

    let res: Response;
    try {
      res = await fetch(url.toString(), { headers, cache: "no-store" });
    } catch {
      continue;
    }
    if (!res.ok) continue;

    const json: unknown = await res.json();
    const parsed = parseApiResponse(json);
    if (hasRealFootballApiErrors(parsed.errors)) continue;

    const rows = parsed.response ?? [];
    const normalized: NormalizedFixture[] = [];
    for (const row of rows) {
      const r = row as { league?: { id?: unknown } };
      const lid =
        typeof r.league?.id === "number" ? r.league.id : Number(r.league?.id);
      if (!Number.isFinite(lid) || !TRACKED_LEAGUE_IDS.has(lid)) continue;
      normalized.push(normalizeFixtureRow(row as ApiFixtureRow));
    }

    const enriched = await enrichFixturesWithLiveStatistics(normalized);

    for (const fx of enriched) {
      out.set(fx.id, fx);
    }
  }

  return out;
}
