import { DECIMAL_CLAMP } from "@/lib/probix-engine/config";
import { blendEngineWeights } from "@/lib/probix-engine/features";
import type {
  MarketCandidate,
  ProbixEngineInput,
  ProbixFeatures,
} from "@/lib/probix-engine/types";

const MARGIN_FACTOR = 0.92;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function clampProb(p: number): number {
  return Math.min(0.9, Math.max(0.08, p));
}

function impliedDecimalFromP(p: number): number {
  const fair = 1 / p;
  const d = fair * MARGIN_FACTOR;
  return Number(
    Math.min(
      DECIMAL_CLAMP.max,
      Math.max(DECIMAL_CLAMP.min, d),
    ).toFixed(2),
  );
}

function deriveConfidence(opts: {
  statSignal: number;
  dataQuality01: number;
  formCue: number;
  contextCue: number;
}): number {
  const body =
    blendEngineWeights({
      form: opts.formCue,
      attack: opts.statSignal,
      defense: opts.statSignal * 0.9,
      context: opts.contextCue,
      agreement: opts.statSignal * 0.85,
      variance: 1 - Math.abs(opts.statSignal - 0.55) * 1.1,
    }) * 0.55 + opts.dataQuality01 * 0.45;
  return Math.min(0.92, Math.max(0.35, body));
}

export function generateMarketCandidates(
  input: ProbixEngineInput,
  f: ProbixFeatures,
): MarketCandidate[] {
  const { home, away, h2h } = input;
  const out: MarketCandidate[] = [];

  const formCue = (f.formStrengthHome + f.formStrengthAway) / 2;
  const h2hCue =
    h2h.avgTotalGoals != null
      ? clampProb(sigmoid((h2h.avgTotalGoals - 2.1) * 0.95) + 0.08) * 0.5
      : 0.12;

  const pO15 = clampProb(sigmoid((f.lambdaGoals - 1.15) * 1.05));
  out.push({
    marketId: "goals_o15",
    family: "goals_high",
    label: "Goluri (total)",
    selection: "Peste 1.5 goluri",
    p: pO15,
    confidence: deriveConfidence({
      statSignal: pO15,
      dataQuality01: f.dataQuality01,
      formCue,
      contextCue: Math.min(0.35, h2hCue) + formCue * 0.4,
    }),
    estimatedDecimal: impliedDecimalFromP(pO15),
    rationaleKeys: ["lambda_goals"],
  });

  const pO25 = clampProb(sigmoid((f.lambdaGoals - 2.0) * 0.92));
  if (pO25 >= 0.44) {
    out.push({
      marketId: "goals_o25",
      family: "goals_high",
      label: "Goluri (total)",
      selection: "Peste 2.5 goluri",
      p: pO25,
      confidence: deriveConfidence({
        statSignal: pO25,
        dataQuality01: f.dataQuality01,
        formCue,
        contextCue: h2hCue * 1.25,
      }),
      estimatedDecimal: impliedDecimalFromP(pO25),
      rationaleKeys: ["lambda_goals", "risk_higher_than_o15"],
    });
  }

  const pU25 = clampProb(sigmoid(-(f.lambdaGoals - 2.15) * 1.05));
  if (pU25 >= 0.52) {
    out.push({
      marketId: "goals_u25",
      family: "goals_low",
      label: "Goluri (total)",
      selection: "Sub 2.5 goluri",
      p: pU25,
      confidence: deriveConfidence({
        statSignal: pU25,
        dataQuality01: f.dataQuality01,
        formCue: 1 - formCue,
        contextCue: 0.1,
      }),
      estimatedDecimal: impliedDecimalFromP(pU25),
      rationaleKeys: ["defensive_tempo"],
    });
  }

  const bttsBase =
    (1 - Math.min(0.92, home.failedToScorePct)) *
      (1 - Math.min(0.92, away.failedToScorePct));
  const pBtts = clampProb(sigmoid((f.lambdaGoals - 2.35) * 0.72) * 0.55 + bttsBase * 0.45);

  out.push({
    marketId: "btts_yes",
    family: "goals_high",
    label: "Ambele marchează",
    selection: "Da",
    p: pBtts,
    confidence: deriveConfidence({
      statSignal: pBtts,
      dataQuality01: f.dataQuality01,
      formCue,
      contextCue: h2hCue,
    }),
    estimatedDecimal: impliedDecimalFromP(pBtts),
    rationaleKeys: ["attack_balance", "failed_to_score"],
  });

  const pCorn95 = clampProb(sigmoid((f.cornerPace - 9.2) * 0.22));
  if (pCorn95 >= 0.5) {
    out.push({
      marketId: "corners_o95",
      family: "corners",
      label: "Cornere (total)",
      selection: "Peste 9.5",
      p: pCorn95,
      confidence: deriveConfidence({
        statSignal: pCorn95,
        dataQuality01: f.dataQuality01,
        formCue,
        contextCue:
          home.cornersForAvg != null && away.cornersForAvg != null
            ? 0.22
            : 0.1,
      }),
      estimatedDecimal: impliedDecimalFromP(pCorn95),
      rationaleKeys: ["corner_tempo"],
    });
  }

  const pCorn85 = clampProb(sigmoid((f.cornerPace - 8.05) * 0.26));
  if (pCorn85 >= 0.54) {
    out.push({
      marketId: "corners_o85",
      family: "corners",
      label: "Cornere (total)",
      selection: "Peste 8.5",
      p: pCorn85,
      confidence: deriveConfidence({
        statSignal: pCorn85,
        dataQuality01: f.dataQuality01,
        formCue,
        contextCue: 0.15,
      }),
      estimatedDecimal: impliedDecimalFromP(pCorn85),
      rationaleKeys: ["corner_tempo_safe"],
    });
  }

  const pCards35 = clampProb(sigmoid((f.cardTempo - 3.25) * 0.35));
  if (pCards35 >= 0.5) {
    out.push({
      marketId: "cards_o35",
      family: "cards",
      label: "Cartonașe galbene",
      selection: "Peste 3.5 (echipe combinate)",
      p: pCards35,
      confidence: deriveConfidence({
        statSignal: pCards35,
        dataQuality01: f.dataQuality01,
        formCue,
        contextCue: home.yellowAvg != null ? 0.2 : 0.08,
      }),
      estimatedDecimal: impliedDecimalFromP(pCards35),
      rationaleKeys: ["discipline_pressure"],
    });
  }

  const homeEdge =
    f.formStrengthHome +
    home.goalsForAvgHome -
    f.awayAttack -
    f.formStrengthAway * 1.05;
  const pNotAwayWin =
    clampProb(sigmoid(homeEdge * 0.28) * 0.55 + (1 / 3) * 0.45);
  const pSafeDouble = Math.min(0.88, Math.max(0.56, (pNotAwayWin + 0.12) / 1.06));

  if (pSafeDouble >= 0.58 && homeEdge > -0.02) {
    out.push({
      marketId: "dc_1x",
      family: "result_safe",
      label: "Șansă dublă",
      selection: "1 sau X",
      p: pSafeDouble,
      confidence: deriveConfidence({
        statSignal: pSafeDouble,
        dataQuality01: f.dataQuality01,
        formCue: f.formStrengthHome,
        contextCue: Math.max(0, homeEdge),
      }),
      estimatedDecimal: impliedDecimalFromP(pSafeDouble),
      rationaleKeys: ["home_stability_dc"],
    });
  }

  return out;
}
