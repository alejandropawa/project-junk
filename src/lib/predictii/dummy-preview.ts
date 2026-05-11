import type { NormalizedFixture } from "@/lib/football-api/types";
import type { PredictionPayload } from "@/lib/predictions/types";

/** ID fictiv; negativ — nu intră în request-uri API Football. */
export const DUMMY_PREDICTII_FIXTURE_ID = -9_000_001;

export function isDummyPredictiiFixtureId(id: number): boolean {
  return id === DUMMY_PREDICTII_FIXTURE_ID;
}

/** Doar local / staging: nu expunem cardul demo în producție fără intent. */
export function shouldShowDummyPredictiiCard(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DUMMY_PREDII_CARD === "true";
}

/**
 * Meci + predicție statice pentru validare UI ca user autentificat
 * (setează NEXT_PUBLIC_SHOW_DUMMY_PREDII_CARD=true în .env.local).
 */
export function buildDummyPredictiiPreview(dateRo: string): {
  fixture: NormalizedFixture;
  prediction: PredictionPayload;
} {
  const kickoffMs = Date.parse(`${dateRo}T17:30:00+03:00`);
  const ts = Number.isFinite(kickoffMs)
    ? Math.floor(kickoffMs / 1000)
    : Math.floor(Date.now() / 1000);

  const fixture: NormalizedFixture = {
    id: DUMMY_PREDICTII_FIXTURE_ID,
    leagueId: 9_000_001,
    season: new Date(ts * 1000).getFullYear(),
    leagueName: "Probix · demo UI",
    leagueLogo: null,
    kickoffIso: new Date(ts * 1000).toISOString(),
    timestamp: ts,
    statusShort: "FT",
    statusLong: "Finished",
    minute: null,
    homeTeamId: 9001,
    awayTeamId: 9002,
    homeName: "FCSB",
    awayName: "CFR Cluj",
    homeLogo: null,
    awayLogo: null,
    homeGoals: 2,
    awayGoals: 1,
    bucket: "finished",
    liveStatsSplit: {
      home: {
        shotsOnGoal: 6,
        shotsTotal: 14,
        corners: 5,
        fouls: 11,
        dangerousAttacks: 48,
        attacksNormal: 92,
        possessionPct: 54,
        yellowCards: 2,
        redCards: 0,
      },
      away: {
        shotsOnGoal: 4,
        shotsTotal: 10,
        corners: 4,
        fouls: 13,
        dangerousAttacks: 41,
        attacksNormal: 85,
        possessionPct: 46,
        yellowCards: 3,
        redCards: 0,
      },
    },
  };

  /* Scor 2-1 → toate cele trei piețe sunt câștigate la final. */
  const prediction: PredictionPayload = {
    generatedAt: new Date(ts * 1000 - 3_600_000).toISOString(),
    oddsApiEventId: 0,
    comboType: "triple",
    comboScore: 0.389,
    comboProbability: 0.285,
    totalEdge: 0.06,
    picks: [
      {
        marketId: "goals_o15",
        marketLabel: "Total goluri",
        selection: "Peste 1,5 goluri",
        decimal: 1.22,
        modelProb: 0.72,
        bookmakerProb: 0.548,
        edgeScore: 0.097,
        oddsSource: "bookmaker",
        pickConfidence: 0.61,
        correlationTags: ["goals_over"],
      },
      {
        marketId: "btts_yes",
        marketLabel: "Ambele echipe marchează",
        selection: "Da",
        decimal: 1.75,
        modelProb: 0.54,
        bookmakerProb: 0.572,
        edgeScore: -0.065,
        oddsSource: "bookmaker",
        pickConfidence: 0.52,
        correlationTags: ["btts_yes"],
      },
      {
        marketId: "dc_1x",
        marketLabel: "Șansă dublă",
        selection: "1 sau X",
        decimal: 1.35,
        modelProb: 0.64,
        bookmakerProb: 0.59,
        edgeScore: 0.065,
        oddsSource: "bookmaker",
        pickConfidence: 0.71,
        correlationTags: ["double_chance", "dc_1x"],
      },
    ],
    calibrationSnapshot: {
      fixtureIdHint: DUMMY_PREDICTII_FIXTURE_ID,
      comboType: "triple",
      combinedOddsAtGenerate: 2.88,
    },
    confidenceAvg: 0.61,
    confidenceScore: 61,
    settlement: "won",
    riskRating: "medium",
    estimatedCombinedDecimal: 2.88,
    explanationBullets: [
      "Formă ofensivă bună la ambele echipe — așteptat minim două goluri în total.",
      "BTTS rezonabil dat fiind că gazdele și oaspeții au marcatori în zonă bună.",
      "Șansa dublă 1X acoperă egalul sau victoria echipei care joacă acasă.",
    ],
    engineVersion: "dummy-preview",
    modelClass: "ui-validation",
    calibrationOutcome: {
      settledAt: new Date(ts * 1000).toISOString(),
      comboResult: "won",
      pickResults: [
        { marketId: "goals_o15", result: "won" },
        { marketId: "btts_yes", result: "won" },
        { marketId: "dc_1x", result: "won" },
      ],
    },
  };

  return { fixture, prediction };
}
