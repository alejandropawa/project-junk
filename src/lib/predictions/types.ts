export type ProbixOddsSource = "bookmaker" | "synthetic_fallback";

export type PredictionPick = {
  marketLabel: string;
  selection: string;
  /** Cotă utilizată pentru afișare (agent sau fallback sintetic la lipsă linie în API). */
  decimal: number;
  /** ID intern Probix pentru mapare cote Odds API (nu afișat în UI implicit). */
  marketId?: string;
  modelProb?: number;
  /** Probabilitate după strat calibrare (dacă există date suficiente). */
  calibratedModelProb?: number;
  bookmakerProb?: number;
  edgeScore?: number;
  openingOdds?: number;
  closingOdds?: number;
  clvPercent?: number;
  flatStakeProfit?: number;
  oddsSource?: ProbixOddsSource;
  /** Încredere agregată (formă/date) pentru leg. */
  pickConfidence?: number;
  correlationTags?: string[];
};

/** După final: agregat pentru biletele combinate (setat de backend / evaluare). */
export type PredictionSettlement = "pending" | "won" | "lost" | "void";

export type RiskRating = "low" | "medium" | "high";

/** Snapshot pentru analize / calibrare ulterioare (JSONB în `prediction_reports`). */
export type PredictionCalibrationSnapshot = {
  fixtureIdHint?: number;
  /** Pentru învățare / filtrare ligi fără join suplimentar. */
  leagueId?: number;
  leagueName?: string;
  comboType?: "single" | "double" | "triple";
  comboScore?: number;
  comboProbability?: number;
  totalEdge?: number;
  combinedOddsAtGenerate?: number;
  picksDetail?: Array<{
    marketId?: string;
    modelProb?: number;
    calibratedModelProb?: number;
    bookmakerProb?: number;
    bookmakerOdds?: number;
    edgeScore?: number;
    openingOdds?: number;
    closingOdds?: number;
    clvPercent?: number;
    flatStakeProfit?: number;
    oddsSource?: ProbixOddsSource;
    pickConfidence?: number;
    correlationTags?: string[];
  }>;
};

/** Populat la settlement (cron) pentru etichetare hit/miss per picior. */
export type PredictionCalibrationOutcome = {
  settledAt: string;
  comboResult: Exclude<PredictionSettlement, "pending">;
  pickResults: Array<{
    marketId?: string;
    result: "won" | "lost" | "pending" | "void";
  }>;
};

export type PredictionPayload = {
  generatedAt: string;
  oddsApiEventId: number;
  picks: PredictionPick[];
  confidenceAvg: number;
  settlement?: PredictionSettlement;
  /** 0–100 (motor deterministic). */
  confidenceScore?: number;
  narrative?: string;
  explanationBullets?: string[];
  riskRating?: RiskRating;
  estimatedCombinedDecimal?: number;
  engineVersion?: string;
  modelClass?: string;
  comboType?: "single" | "double" | "triple";
  comboScore?: number;
  comboProbability?: number;
  totalEdge?: number;
  calibrationSnapshot?: PredictionCalibrationSnapshot;
  calibrationOutcome?: PredictionCalibrationOutcome;
};

export type StoredPredictionRow = {
  fixture_id: number;
  date_ro: string;
  payload: PredictionPayload;
  created_at?: string;
};
