import type { NormalizedFixture } from "@/lib/football-api/types";

export type RiskRating = "low" | "medium" | "high";

export type MarketFamily =
  | "goals_high"
  | "goals_low"
  | "corners"
  | "cards"
  | "fouls"
  | "result_safe"
  | "btts";

export type OddsSource = "bookmaker" | "synthetic_fallback";

export type MarketCandidate = {
  marketId: string;
  family: MarketFamily;
  /** Etichetă afișată utilizatorului (RO). */
  label: string;
  selection: string;
  /** Probabilitate estimată 0–1 (determinist). */
  p: number;
  /** După calibrare + stabilitate + încredere familie (opțional, pentru afișare). */
  calibratedProb?: number;
  /** Încredere în semnal 0–1 (agregare formă/date). */
  confidence: number;
  /**
   * Fallback sintetic pentru UI / lipsă Odds API: (1/p)*marjă, clamp.
   * Selecția folosește `bookmakerDecimal` când există cotă reală.
   */
  estimatedDecimal: number;
  /** Contribuții pentru explicații (ponderi simple). */
  rationaleKeys: string[];
  /** Populated după mapare Odds API (sau egal cu `estimatedDecimal` la fallback). */
  bookmakerDecimal?: number;
  bookmakerImpliedProb?: number;
  /** Model − implied; 0 dacă lipsă cotă agent. */
  edgeScore?: number;
  oddsSource?: OddsSource;
  correlationTags?: string[];
};

export type TeamProfile = {
  teamId: number;
  playedTotal: number;
  playedHome: number;
  playedAway: number;
  goalsForAvgTotal: number;
  goalsAgainstAvgTotal: number;
  goalsForAvgHome: number;
  goalsForAvgAway: number;
  goalsAgainstAvgHome: number;
  goalsAgainstAvgAway: number;
  formLast5Wdl: { w: number; d: number; l: number };
  cornersForAvg: number | null;
  yellowAvg: number | null;
  redAvg: number | null;
  /** Faulturi comise (medie / meci) dacă apare în /teams/statistics. */
  foulsCommittedAvg: number | null;
  shotsOnTargetForAvg: number | null;
  shotsTotalForAvg: number | null;
  possessionAvg: number | null;
  cleanSheetPct: number;
  failedToScorePct: number;
};

export type H2HSummary = {
  samples: number;
  avgTotalGoals: number | null;
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
};

export type ProbixFeatures = {
  lambdaGoals: number;
  homeAttack: number;
  awayAttack: number;
  homeConcede: number;
  awayConcede: number;
  cornerPace: number;
  cardTempo: number;
  /** Ritm combinat faulturi (proxy). */
  foulPace: number;
  formStrengthHome: number;
  formStrengthAway: number;
  dataQuality01: number;
  h2hAvgGoals: number | null;
};

export type ProbixEngineInput = {
  fixture: NormalizedFixture;
  home: TeamProfile;
  away: TeamProfile;
  h2h: H2HSummary;
};

export type ProbixComboType = "single" | "double" | "triple";

export type ProbixEngineOutput = {
  picks: MarketCandidate[];
  comboType: ProbixComboType;
  /** Scor intern combinație câștigătoare (nu cotă). */
  comboScore: number;
  /** Probabilitate combinată ajustată pentru corelație (0–1). */
  comboProbability: number;
  totalEdge: number;
  confidenceScore: number;
  confidenceAvg: number;
  estimatedCombinedDecimal: number;
  riskRating: RiskRating;
  explanationBullets: string[];
  engineVersion: string;
};
