import { defaultEuropeanSeasonYearFromTrackedDay } from "@/lib/football-api/bucharest-calendar";
import type { NormalizedFixture } from "@/lib/football-api/types";
import type { PredictionReportRow } from "@/lib/predictions/prediction-repository";

function inferSeasonUtc(isoKickoff: string): number | null {
  try {
    const d = new Date(isoKickoff);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    if (Number.isNaN(d.getTime())) return null;
    return m >= 7 ? y : y - 1;
  } catch {
    return null;
  }
}

/**
 * Fallback când nu avem rândul complet din API-Football (ex. ligă scosă din batch sau meci vechi).
 * Păstrează același contract `NormalizedFixture` ca în `predictii` pentru `PredictionCard`.
 */
export function toSyntheticFinishedFixture(
  row: PredictionReportRow,
): NormalizedFixture {
  const kick = row.kickoff_iso;
  const tsMs = Date.parse(kick);
  const ts = Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : Math.floor(Date.now() / 1000);
  const leagueId = row.payload.calibrationSnapshot?.leagueId ?? 0;
  const season =
    inferSeasonUtc(kick) ?? defaultEuropeanSeasonYearFromTrackedDay();

  return {
    id: row.fixture_id,
    leagueId,
    season,
    leagueName: row.league_name,
    leagueLogo: null,
    kickoffIso: kick,
    timestamp: ts,
    statusShort: "FT",
    statusLong: "Meci terminat",
    minute: 90,
    homeTeamId: 0,
    awayTeamId: 0,
    homeName: row.home_name,
    awayName: row.away_name,
    homeLogo: null,
    awayLogo: null,
    homeGoals: null,
    awayGoals: null,
    bucket: "finished",
    liveStatsSplit: undefined,
  };
}
