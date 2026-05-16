import type { CalibrationBundle } from "@/lib/probix-evolution/calibration-model";
import type { ProbixSelectionModeName } from "@/lib/probix-evolution/selection-profile";
import type { PredictionPayload } from "@/lib/predictions/types";

export type FamilyHitSlice = {
  family: string;
  n: number;
  hit: number;
};

export type { PickObservation } from "@/lib/probix-evolution/observation-types";

export type LearningBuildSummary = {
  /** Rânduri încărcate din DB. */
  reportsRows: number;
  /** Picioare cu rezultat cunoscut won/lost/void (void excluse din rate). */
  pickObservations: number;
  /** Hit rate global picioare (fără void). */
  globalHitRate: number | null;
};

export type ProbixLearningContext = {
  calibration: CalibrationBundle;
  /** Per `marketId` după istoric suficient (~200 observații / piață). */
  marketPScale: ReadonlyMap<string, number>;
  /** Factor moale per ligă (nu blochează); ~0.76–1.08. */
  leagueProbFactor: ReadonlyMap<string, number>;
  /** Per familie (goals/BTTS/dc…). ~0.86–1.1. */
  familyReliability: ReadonlyMap<string, number>;
  /** Observatii istorice per familie, folosite de value gate. */
  familySampleSize: ReadonlyMap<string, number>;
  /** Observatii istorice per liga, folosite de value gate. */
  leagueSampleSize: ReadonlyMap<string, number>;
  /** Blocare doar pentru eșantion foarte mare + subperformanță severă. */
  hardBlockedLeagueNames: ReadonlySet<string>;
  summary: LearningBuildSummary;
};

export type CalibrationBin = {
  binMin: number;
  binMax: number;
  count: number;
  meanPredicted: number;
  meanOutcome: number;
  /** meanOutcome - meanPredicted (pozitiv = supra-încrezător). */
  gap: number;
};

export type ProbixEvolutionMonitoring = {
  brierScoreRaw: number | null;
  brierScoreCalibrated: number | null;
  meanAbsCalibrationError: number | null;
  familyHits: FamilyHitSlice[];
  oddsSourcePerformance: {
    bookmaker: { n: number; hit: number };
    synthetic_fallback: { n: number; hit: number };
  };
  comboHitRates: {
    single: { n: number; hit: number };
    double: { n: number; hit: number };
    triple: { n: number; hit: number };
  };
  /** Când modul nu e în payload, reflectă `PROBIX_SELECTION_MODE` curent. */
  effectiveSelectionModeApprox: ProbixSelectionModeName;
  leagueReliabilitySample: Array<{
    name: string;
    n: number;
    hit: number;
    probFactor: number;
  }>;
};

export type ProbixEvolutionSummary = {
  learning: LearningBuildSummary;
  calibrationBins: CalibrationBin[];
  topMarketsUndershoot: Array<{ marketId: string; n: number; hit: number; avgP: number }>;
  topMarketsOvershoot: Array<{ marketId: string; n: number; hit: number; avgP: number }>;
  leagues: Array<{ name: string; n: number; hit: number }>;
  monitoring: ProbixEvolutionMonitoring;
};

export type PredictionReportLite = {
  league_name: string;
  payload: PredictionPayload;
};
