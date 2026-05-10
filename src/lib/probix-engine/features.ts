import { WEIGHTS } from "@/lib/probix-engine/config";
import type { ProbixEngineInput, ProbixFeatures } from "@/lib/probix-engine/types";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Punctaj formă 0–1 din ultimele 5 (determinist). */
function formStrength(wdl: { w: number; d: number; l: number }): number {
  const pts = wdl.w * 3 + wdl.d * 1;
  return clamp01(pts / 15);
}

function cornerProxy(team: ProbixEngineInput["home"]): number {
  if (team.cornersForAvg != null && team.cornersForAvg > 0.5)
    return team.cornersForAvg;
  const sot = team.shotsOnTargetForAvg ?? 4.2;
  return Math.min(12, Math.max(3.5, sot * 1.15));
}

function cardProxy(team: ProbixEngineInput["home"]): number {
  if (team.yellowAvg != null && team.yellowAvg > 0.5)
    return team.yellowAvg + (team.redAvg ?? 0) * 1.6;
  return 3.2;
}

export function buildProbixFeatures(input: ProbixEngineInput): ProbixFeatures {
  const { home, away, h2h } = input;

  const part1 = home.goalsForAvgHome + away.goalsAgainstAvgAway;
  const part2 = away.goalsForAvgAway + home.goalsAgainstAvgHome;
  const lambdaGoals = Math.max(0.8, (part1 + part2) / 2);

  const homeAttack = home.goalsForAvgHome;
  const awayAttack = away.goalsForAvgAway;
  const homeConcede = home.goalsAgainstAvgHome;
  const awayConcede = away.goalsAgainstAvgAway;

  const cornerPace = (cornerProxy(home) + cornerProxy(away)) / 2;
  const cardTempo = (cardProxy(home) + cardProxy(away)) / 2;

  const formStrengthHome = formStrength(home.formLast5Wdl);
  const formStrengthAway = formStrength(away.formLast5Wdl);

  let dq = 0.45;
  if (home.playedTotal >= 6 && away.playedTotal >= 6) dq += 0.15;
  if (home.cornersForAvg != null && away.cornersForAvg != null) dq += 0.12;
  if (home.shotsOnTargetForAvg != null && away.shotsOnTargetForAvg != null)
    dq += 0.1;
  if (h2h.samples >= 4) dq += 0.1;
  if (home.yellowAvg != null && away.yellowAvg != null) dq += 0.08;

  return {
    lambdaGoals,
    homeAttack,
    awayAttack,
    homeConcede,
    awayConcede,
    cornerPace,
    cardTempo,
    formStrengthHome,
    formStrengthAway,
    dataQuality01: clamp01(dq),
    h2hAvgGoals: h2h.avgTotalGoals,
  };
}

/** Agregare simplă ponderată pentru raportare - nu e probabilitate finală. */
export function blendEngineWeights(
  parts: {
    form: number;
    attack: number;
    defense: number;
    context: number;
    agreement: number;
    variance: number;
  },
): number {
  return (
    parts.form * WEIGHTS.recentForm +
    parts.attack * WEIGHTS.attack +
    parts.defense * WEIGHTS.defense +
    parts.context * WEIGHTS.context +
    parts.agreement * WEIGHTS.marketAgreement +
    parts.variance * WEIGHTS.varianceGuard
  );
}
