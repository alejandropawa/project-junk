import { DECIMAL_CLAMP } from "@/lib/probix-engine/config";
import { blendEngineWeights } from "@/lib/probix-engine/features";
import { matchWinDrawAwayProbs } from "@/lib/probix-engine/match-outcome-model";
import {
  poissonTailAtLeast,
  poissonTailAtMost,
} from "@/lib/probix-engine/poisson-tail";
import { totalsMarketId } from "@/lib/probix-engine/total-market-id";
import type {
  MarketCandidate,
  ProbixEngineInput,
  ProbixFeatures,
} from "@/lib/probix-engine/types";

const MARGIN_FACTOR = 0.86;

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
    }) *
      0.55 +
    opts.dataQuality01 * 0.45;
  return Math.min(0.92, Math.max(0.35, body));
}

type Facet = "goals" | "corners" | "cards" | "fouls";

/** Prag probabilistic ușor asimetric — favorizează picioare cu cote în intervalul dorit. */
function acceptLeg(p: number, over: boolean): boolean {
  if (over) return p >= 0.36 && p <= 0.82;
  return p >= 0.36 && p <= 0.8;
}

function lambdaSumForFacet(
  f: ProbixFeatures,
  facet: Facet,
): number {
  switch (facet) {
    case "goals":
      return Math.max(0.85, f.lambdaGoals);
    case "corners":
      return Math.max(5, f.cornerPace * 2);
    case "cards":
      return Math.max(1.4, f.cardTempo * 2);
    case "fouls":
      return Math.max(14, f.foulPace * 2);
    default:
      return 1;
  }
}

function pushTotalHalfLine(
  out: MarketCandidate[],
  facet: Facet,
  line: number,
  over: boolean,
  lam: number,
  family: MarketCandidate["family"],
  labelRo: string,
  f: ProbixFeatures,
  formCue: number,
  ctx: number,
  rationaleKeys: string[],
): void {
  const pRaw = over
    ? poissonTailAtLeast(Math.floor(line + 1e-9) + 1, lam)
    : poissonTailAtMost(Math.floor(line + 1e-9), lam);

  const p = clampProb(pRaw);
  if (!acceptLeg(p, over)) return;

  const id = totalsMarketId(facet, over, line);
  const decimals = `${line}`
    .replace(".", ",")
    .replace(/,0$/, "");
  const selection = over
    ? `Peste ${decimals} (${facetRo(facet)})`
    : `Sub ${decimals} (${facetRo(facet)})`;

  out.push({
    marketId: id,
    family,
    label: labelRo,
    selection,
    p,
    confidence: deriveConfidence({
      statSignal: p,
      dataQuality01: f.dataQuality01,
      formCue,
      contextCue: ctx,
    }),
    estimatedDecimal: impliedDecimalFromP(p),
    rationaleKeys,
  });
}

function facetRo(f: Facet): string {
  switch (f) {
    case "goals":
      return "total goluri";
    case "corners":
      return "total cornere";
    case "cards":
      return "cartonașe galbene comb.";
    case "fouls":
      return "faulturi comb.";
    default:
      return "total";
  }
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

  /** Goluri total — linii 0,5 … 4,5 (ambe sensuri unde are sens statistic). */
  const lamG = lambdaSumForFacet(f, "goals");
  for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    for (const over of [true, false]) {
      const fam: MarketCandidate["family"] =
        over ? "goals_high" : "goals_low";
      pushTotalHalfLine(
        out,
        "goals",
        line,
        over,
        lamG,
        fam,
        "Goluri (total)",
        f,
        formCue,
        h2hCue * (over ? 1.35 : 0.42),
        over ? ["lambda_goals"] : ["defensive_tempo"],
      );
    }
  }

  /** Cornere — praguri întregi uzuale agentați. */
  const lamC = lambdaSumForFacet(f, "corners");
  for (const line of [6.5, 7.5, 8.5, 9.5, 10.5, 11.5]) {
    for (const over of [true, false]) {
      pushTotalHalfLine(
        out,
        "corners",
        line,
        over,
        lamC,
        "corners",
        "Cornere (total)",
        f,
        formCue,
        home.cornersForAvg != null && away.cornersForAvg != null ? 0.24 : 0.12,
        ["corner_tempo"],
      );
    }
  }

  /** Cartonașe galbene combinate */
  const lamY = lambdaSumForFacet(f, "cards");
  for (const line of [2.5, 3.5, 4.5, 5.5]) {
    for (const over of [true, false]) {
      pushTotalHalfLine(
        out,
        "cards",
        line,
        over,
        lamY,
        "cards",
        "Cartonașe galbene",
        f,
        formCue,
        home.yellowAvg != null ? 0.22 : 0.1,
        ["discipline_pressure"],
      );
    }
  }

  /** Faulturi totale în meci (proxy dacă lipsesc din API). */
  const lamF = lambdaSumForFacet(f, "fouls");
  for (const line of [18.5, 20.5, 22.5, 24.5, 26.5, 28.5]) {
    for (const over of [true, false]) {
      pushTotalHalfLine(
        out,
        "fouls",
        line,
        over,
        lamF,
        "fouls",
        "Faulturi (total)",
        f,
        formCue,
        home.foulsCommittedAvg != null ? 0.2 : 0.08,
        ["fouls_tempo"],
      );
    }
  }

  /** BTTS — da / nu (Poisson independenți pe gazde/oaspeți). */
  const sAtk = Math.max(0.25, f.homeAttack + f.awayAttack);
  const lamH = Math.max(0.25, (f.lambdaGoals * f.homeAttack) / sAtk);
  const lamA = Math.max(0.25, (f.lambdaGoals * f.awayAttack) / sAtk);
  const pHs = Math.min(0.995, 1 - Math.exp(-lamH));
  const pAs = Math.min(0.995, 1 - Math.exp(-lamA));
  const bttsYes = clampProb(pHs * pAs);
  const bttsNo = clampProb(1 - pHs * pAs);

  if (bttsYes >= 0.38 && bttsYes <= 0.82) {
    out.push({
      marketId: "btts_yes",
      family: "goals_high",
      label: "Ambele marchează",
      selection: "Da — ambele echipe vor înscrie",
      p: bttsYes,
      confidence: deriveConfidence({
        statSignal: bttsYes,
        dataQuality01: f.dataQuality01,
        formCue,
        contextCue: h2hCue,
      }),
      estimatedDecimal: impliedDecimalFromP(bttsYes),
      rationaleKeys: ["attack_balance", "failed_to_score"],
    });
  }

  if (bttsNo >= 0.36 && bttsNo <= 0.8) {
    out.push({
      marketId: "btts_no",
      family: "goals_low",
      label: "Ambele marchează",
      selection: "Nu — cel puțin o echipă rămâne fără gol",
      p: bttsNo,
      confidence: deriveConfidence({
        statSignal: bttsNo,
        dataQuality01: f.dataQuality01,
        formCue: 1 - formCue,
        contextCue: 0.08,
      }),
      estimatedDecimal: impliedDecimalFromP(bttsNo),
      rationaleKeys: ["clean_sheet_pressure"],
    });
  }

  /** Șanse duble 1X / X2 / 12 */
  const { pHome, pDraw, pAway } = matchWinDrawAwayProbs(lamH, lamA);
  const p1x = clampProb(pHome + pDraw);
  const px2 = clampProb(pDraw + pAway);
  const p12 = clampProb(pHome + pAway);

  if (p1x >= 0.55 && p1x <= 0.88) {
    out.push({
      marketId: "dc_1x",
      family: "result_safe",
      label: "Șansă dublă",
      selection: "1X — gazda nu pierde",
      p: p1x,
      confidence: deriveConfidence({
        statSignal: p1x,
        dataQuality01: f.dataQuality01,
        formCue: f.formStrengthHome,
        contextCue: Math.max(0, f.homeAttack - f.awayAttack) * 0.12,
      }),
      estimatedDecimal: impliedDecimalFromP(p1x),
      rationaleKeys: ["home_stability_dc"],
    });
  }

  if (px2 >= 0.55 && px2 <= 0.88) {
    out.push({
      marketId: "dc_x2",
      family: "result_safe",
      label: "Șansă dublă",
      selection: "X2 — oaspeții nu pierd",
      p: px2,
      confidence: deriveConfidence({
        statSignal: px2,
        dataQuality01: f.dataQuality01,
        formCue: f.formStrengthAway,
        contextCue: Math.max(0, f.awayAttack - f.homeAttack) * 0.12,
      }),
      estimatedDecimal: impliedDecimalFromP(px2),
      rationaleKeys: ["away_stability_dc"],
    });
  }

  if (p12 >= 0.55 && p12 <= 0.9) {
    out.push({
      marketId: "dc_12",
      family: "result_safe",
      label: "Șansă dublă",
      selection: "12 — fără egal (câștigă una din echipe)",
      p: p12,
      confidence: deriveConfidence({
        statSignal: p12,
        dataQuality01: f.dataQuality01,
        formCue: Math.abs(formCue - 0.5),
        contextCue:
          Math.min(pHome, pAway) > 0.22 ? Math.min(pHome, pAway) * 0.3 : 0.08,
      }),
      estimatedDecimal: impliedDecimalFromP(p12),
      rationaleKeys: ["either_wins_dc"],
    });
  }

  return out;
}
