import { liveTotalsFromFixture } from "@/lib/football-api/fixture-live-stats";
import { isTerminalFixtureStatus } from "@/lib/football-api/bucket";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { deriveComboVisualSettlement } from "@/lib/predictions/pick-result";
import type { PredictionReportRow } from "@/lib/predictions/prediction-repository";

export function isHistoricFixtureFinal(
  fixture: NormalizedFixture | undefined,
): fixture is NormalizedFixture {
  return (
    fixture?.bucket === "finished" &&
    isTerminalFixtureStatus(fixture.statusShort) &&
    fixture.homeGoals != null &&
    fixture.awayGoals != null
  );
}

export function withDerivedHistoricSettlement(
  row: PredictionReportRow,
  fixture?: NormalizedFixture,
): PredictionReportRow {
  const current = row.payload.settlement ?? "pending";
  if (current !== "pending" || !isHistoricFixtureFinal(fixture)) return row;

  const derived = deriveComboVisualSettlement(
    fixture,
    row.payload.picks,
    row.payload.settlement,
    liveTotalsFromFixture(fixture),
  );
  if (derived === "pending") return row;

  return {
    ...row,
    payload: {
      ...row.payload,
      settlement: derived,
    },
  };
}

export function isHistoricRowResolved(row: PredictionReportRow): boolean {
  const s = row.payload.settlement ?? "pending";
  return s === "won" || s === "lost" || s === "void";
}
