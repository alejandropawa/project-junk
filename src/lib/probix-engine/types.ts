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

export type MarketCandidate = {
  marketId: string;
  family: MarketFamily;
  /** Etichetă afișată utilizatorului (RO). */
  label: string;
  selection: string;
  /** Probabilitate estimată 0–1 (determinist). */
  p: number;
  /** Încredere în semnal 0–1. */
  confidence: number;
  /** Cotă estimată (inclusiv marjă agenți). */
  estimatedDecimal: number;
  /** Contribuții pentru explicații (ponderi simple). */
  rationaleKeys: string[];
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

export type ProbixEngineOutput = {
  picks: MarketCandidate[];
  confidenceScore: number;
  confidenceAvg: number;
  estimatedCombinedDecimal: number;
  riskRating: RiskRating;
  explanationBullets: string[];
  engineVersion: string;
};
