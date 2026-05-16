import type {
  NormalizedFixture,
  SportmonksOdd,
  SportmonksPrediction,
} from "@/lib/football-api/types";
import type { MarketCandidate } from "@/lib/probix-engine/types";

export type MatchVolatilityLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EXTREME";

export type MatchVolatilityReason =
  | "LOW_DATA_QUALITY"
  | "RECENT_GOAL_SHOCK_HOME"
  | "RECENT_GOAL_SHOCK_AWAY"
  | "HIGH_GOAL_VARIANCE_HOME"
  | "HIGH_GOAL_VARIANCE_AWAY"
  | "UNSTABLE_FORM_HOME"
  | "UNSTABLE_FORM_AWAY"
  | "H2H_INSTABILITY"
  | "LEAGUE_VOLATILITY"
  | "WEAK_MARKET_HISTORY"
  | "ODDS_MOVED_AGAINST_MODEL"
  | "INSUFFICIENT_SAMPLE_SIZE";

export interface MatchVolatilityReport {
  score01: number;
  level: MatchVolatilityLevel;
  shouldAvoid: boolean;
  shouldBlockCombos: boolean;
  shouldAllowOnlySingles: boolean;
  reasons: MatchVolatilityReason[];
  explanation: string;
}

export type MatchVolatilityInput = {
  fixture: NormalizedFixture;
  dataQuality01?: number;
  candidates?: readonly Pick<
    MarketCandidate,
    "marketId" | "family" | "p" | "bookmakerImpliedProb" | "edgeScore" | "oddsSource"
  >[];
  leagueReliabilityFactor?: number | null;
  familySampleSizeMin?: number | null;
};

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function pct(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

function predictionByType(
  predictions: readonly SportmonksPrediction[],
  typeId: number,
): SportmonksPrediction | undefined {
  return predictions.find((p) => p.type_id === typeId);
}

function probValue(
  predictions: readonly SportmonksPrediction[],
  typeId: number,
  key: string,
): number | null {
  const p = predictionByType(predictions, typeId);
  return p ? pct(p.predictions[key]) : null;
}

function oddsCount(odds: readonly SportmonksOdd[] | undefined): number {
  return (odds ?? []).filter((o) => !o.stopped && o.value != null).length;
}

function addReason(
  set: Set<MatchVolatilityReason>,
  reason: MatchVolatilityReason,
  weight: number,
): number {
  set.add(reason);
  return weight;
}

function levelFromScore(score: number): MatchVolatilityLevel {
  if (score >= 0.78) return "EXTREME";
  if (score >= 0.58) return "HIGH";
  if (score >= 0.34) return "MEDIUM";
  return "LOW";
}

function fixtureMinuteRisk(fixture: NormalizedFixture): number {
  if (fixture.bucket !== "live") return 0;
  const minute = fixture.minute ?? 0;
  if (minute <= 12) return 0.1;
  if (minute <= 25) return 0.06;
  return 0.03;
}

function providerGoalShockScore(
  predictions: readonly SportmonksPrediction[],
  reasons: Set<MatchVolatilityReason>,
): number {
  let score = 0;

  const totalOver35 = probValue(predictions, 236, "yes");
  const totalOver45 = probValue(predictions, 1679, "yes");
  const totalUnder25 = probValue(predictions, 235, "no");

  const homeOver15 = probValue(predictions, 331, "yes");
  const awayOver15 = probValue(predictions, 332, "yes");
  const homeUnder05 = probValue(predictions, 334, "no");
  const awayUnder05 = probValue(predictions, 333, "no");

  if ((homeOver15 ?? 0) >= 0.66 && (totalOver35 ?? 0) >= 0.48) {
    score += addReason(reasons, "RECENT_GOAL_SHOCK_HOME", 0.18);
  }
  if ((awayOver15 ?? 0) >= 0.66 && (totalOver35 ?? 0) >= 0.48) {
    score += addReason(reasons, "RECENT_GOAL_SHOCK_AWAY", 0.18);
  }
  if ((homeOver15 ?? 0) >= 0.7 || (homeUnder05 ?? 0) >= 0.42) {
    score += addReason(reasons, "HIGH_GOAL_VARIANCE_HOME", 0.12);
  }
  if ((awayOver15 ?? 0) >= 0.7 || (awayUnder05 ?? 0) >= 0.42) {
    score += addReason(reasons, "HIGH_GOAL_VARIANCE_AWAY", 0.12);
  }
  if ((totalOver45 ?? 0) >= 0.28) {
    score += addReason(reasons, "H2H_INSTABILITY", 0.12);
  }
  if ((totalOver35 ?? 0) >= 0.52 && (totalUnder25 ?? 0) >= 0.42) {
    score += addReason(reasons, "H2H_INSTABILITY", 0.16);
  }

  return score;
}

function marketDisagreementScore(
  candidates: MatchVolatilityInput["candidates"],
  reasons: Set<MatchVolatilityReason>,
): number {
  if (!candidates?.length) return 0;

  let score = 0;
  const bookmaker = candidates.filter((c) => c.oddsSource === "bookmaker");
  if (bookmaker.length === 0) {
    score += addReason(reasons, "WEAK_MARKET_HISTORY", 0.16);
  }

  const movedAgainst = bookmaker.filter((c) => {
    const implied = c.bookmakerImpliedProb;
    if (implied == null) return false;
    return c.p - implied < -0.035 || (c.edgeScore ?? 0) < -0.04;
  });
  if (movedAgainst.length >= Math.max(2, Math.ceil(bookmaker.length * 0.35))) {
    score += addReason(reasons, "ODDS_MOVED_AGAINST_MODEL", 0.18);
  }

  const highGoals = candidates.filter(
    (c) => c.family === "goals_high" && c.p >= 0.62,
  ).length;
  const lowGoals = candidates.filter(
    (c) => c.family === "goals_low" && c.p >= 0.62,
  ).length;
  if (highGoals > 0 && lowGoals > 0) {
    score += addReason(reasons, "H2H_INSTABILITY", 0.14);
  }

  return score;
}

export function assessMatchVolatility(
  input: MatchVolatilityInput,
): MatchVolatilityReport {
  const { fixture } = input;
  const reasons = new Set<MatchVolatilityReason>();
  const predictions = fixture.sportmonksPredictions ?? [];

  let score = 0;
  const dataQuality01 =
    input.dataQuality01 ??
    clamp01(
      0.18 +
        Math.min(0.3, predictions.length * 0.025) +
        Math.min(0.28, oddsCount(fixture.sportmonksOdds) * 0.006) +
        (fixture.dataDelayed ? -0.18 : 0),
    );

  if (fixture.dataDelayed || dataQuality01 < 0.42) {
    score += addReason(reasons, "LOW_DATA_QUALITY", 0.22);
  }
  if (predictions.length < 4) {
    score += addReason(reasons, "INSUFFICIENT_SAMPLE_SIZE", 0.2);
  }
  if (oddsCount(fixture.sportmonksOdds) < 8) {
    score += addReason(reasons, "WEAK_MARKET_HISTORY", 0.12);
  }
  if ((input.leagueReliabilityFactor ?? 1) <= 0.86) {
    score += addReason(reasons, "LEAGUE_VOLATILITY", 0.18);
  }
  if ((input.familySampleSizeMin ?? Number.POSITIVE_INFINITY) < 80) {
    score += addReason(reasons, "WEAK_MARKET_HISTORY", 0.12);
  }

  score += providerGoalShockScore(predictions, reasons);
  score += marketDisagreementScore(input.candidates, reasons);
  score += fixtureMinuteRisk(fixture);
  score += (1 - dataQuality01) * 0.16;

  const score01 = Number(clamp01(score).toFixed(4));
  const level = levelFromScore(score01);
  const shouldAvoid = level === "EXTREME" || (level === "HIGH" && score01 >= 0.68);
  const shouldBlockCombos = shouldAvoid || level === "HIGH";
  const shouldAllowOnlySingles = shouldBlockCombos || level === "MEDIUM";

  const explanation =
    level === "LOW"
      ? "Match profile is stable enough for normal selection."
      : level === "MEDIUM"
        ? "Some volatility signals are present, so combo generation should be conservative."
        : level === "HIGH"
          ? "Several volatility signals are present; avoid multi-leg exposure."
          : "Extreme volatility or weak evidence detected; NO_BET is preferred.";

  return {
    score01,
    level,
    shouldAvoid,
    shouldBlockCombos,
    shouldAllowOnlySingles,
    reasons: [...reasons],
    explanation,
  };
}
