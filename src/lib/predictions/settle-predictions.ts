import {
  deriveComboVisualSettlement,
  evaluatePickResult,
} from "@/lib/predictions/pick-result";
import type { PredictionPayload } from "@/lib/predictions/types";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { isTerminalFixtureStatus } from "@/lib/football-api/bucket";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { liveTotalsFromFixture } from "@/lib/football-api/fixture-live-stats";
import {
  normalizeSportmonksFixtureRow,
  sportmonksFetch,
  trackedFixtureInclude,
} from "@/lib/football-api/sportmonks";
import {
  calculateOddsMovement,
  sportmonksOddsForPredictionPick,
} from "@/lib/probix-engine/odds-intelligence";
import type { SportmonksFixtureRow } from "@/lib/football-api/types";

const FETCH_CHUNK = 20;

/**
 * Recalculează `settlement` + `pickResults` din **fixture-ul curent** (API + statistici îmbogățite),
 * fără a lua în calcul verdictul deja salvat — folosit la `repair` sau la primul settle.
 */
export function recomputeSettlementPayloadFromFixture(
  nf: NormalizedFixture,
  payload: PredictionPayload,
): PredictionPayload | null {
  if (!payload.picks?.length) return null;
  if (nf.bucket !== "finished") return null;
  if (!isTerminalFixtureStatus(nf.statusShort)) return null;

  const totals = liveTotalsFromFixture(nf);
  const derived = deriveComboVisualSettlement(
    nf,
    payload.picks,
    undefined,
    totals,
  );
  if (derived === "pending") return null;

  const pickResults = payload.picks.map((pick) => ({
    marketId: pick.marketId,
    result: evaluatePickResult(nf, pick, totals),
  }));
  const picks = payload.picks.map((pick) => {
    const closing = sportmonksOddsForPredictionPick(nf, pick);
    const opening = pick.publishedOdds ?? pick.openingOdds ?? pick.decimal;
    const movement = calculateOddsMovement(opening, closing);
    return {
      ...pick,
      ...movement,
      currentOdds: movement.currentOdds ?? pick.currentOdds,
      closingOdds: movement.closingOdds ?? pick.closingOdds,
    };
  });

  return {
    ...payload,
    picks,
    settlement: derived,
    calibrationOutcome: {
      settledAt: new Date().toISOString(),
      comboResult: derived,
      pickResults,
    },
    calibrationSnapshot: payload.calibrationSnapshot
      ? {
          ...payload.calibrationSnapshot,
          picksDetail: picks.map((x) => ({
            marketId: x.marketId,
            modelProb: x.modelProb,
            calibratedModelProb: x.calibratedModelProb,
            bookmakerProb: x.bookmakerProb,
            bookmakerOdds: x.decimal,
            edgeScore: x.edgeScore,
            openingOdds: x.openingOdds,
            publishedOdds: x.publishedOdds,
            currentOdds: x.currentOdds,
            closingOdds: x.closingOdds,
            oddsMovementPct: x.oddsMovementPct,
            movedAgainstModel: x.movedAgainstModel,
            movedWithModel: x.movedWithModel,
            clvPercent: x.clvPercent,
            closingLineValuePct: x.closingLineValuePct,
            flatStakeProfit: x.flatStakeProfit,
            oddsSource: x.oddsSource,
            pickConfidence: x.pickConfidence,
            correlationTags: x.correlationTags,
          })),
        }
      : payload.calibrationSnapshot,
  };
}

/** Actualizează `settlement` pe payload când combinația e decisă la status final din API (doar dacă încă `pending`). */
export function mergedPayloadWithSettlement(
  nf: NormalizedFixture,
  payload: PredictionPayload,
): PredictionPayload | null {
  if (isPredictionCombinationResolved(payload)) return null;
  return recomputeSettlementPayloadFromFixture(nf, payload);
}

export async function fetchNormalizedFixturesByIds(
  ids: readonly number[],
): Promise<Map<number, NormalizedFixture>> {
  const out = new Map<number, NormalizedFixture>();

  for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
    const slice = ids.slice(i, i + FETCH_CHUNK).filter((n) => n > 0);
    if (!slice.length) continue;

    const result = await sportmonksFetch<SportmonksFixtureRow[]>(
      `/fixtures/multi/${slice.join(",")}`,
      {
        include: trackedFixtureInclude(),
        filters: "markets:1,2,14,80,86",
        timezone: "Europe/Bucharest",
      },
      { cache: "no-store" },
    );
    if (!result.ok) continue;

    for (const row of result.data) {
      if (!TRACKED_LEAGUE_IDS.has(row.league_id)) continue;
      const fx = normalizeSportmonksFixtureRow(row);
      out.set(fx.id, fx);
    }
  }

  return out;
}
