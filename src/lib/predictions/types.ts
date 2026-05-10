export type PredictionPick = {
  marketLabel: string;
  selection: string;
  decimal: number;
  /** ID intern Probix pentru mapare cote Odds API (nu afișat în UI implicit). */
  marketId?: string;
};

/** După final: agregat pentru biletele combinate (setat de backend / evaluare). */
export type PredictionSettlement = "pending" | "won" | "lost" | "void";

export type RiskRating = "low" | "medium" | "high";

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
};

export type StoredPredictionRow = {
  fixture_id: number;
  date_ro: string;
  payload: PredictionPayload;
  created_at?: string;
};
