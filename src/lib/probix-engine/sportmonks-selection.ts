import { filterBookmakers } from "@/lib/football-api/sportmonks";
import type {
  NormalizedFixture,
  SportmonksOdd,
  SportmonksPrediction,
} from "@/lib/football-api/types";
import type {
  MarketCandidate,
  MarketFamily,
  ProbixNoBetResult,
  ProbixComboType,
  ProbixEngineOutput,
} from "@/lib/probix-engine/types";
import {
  assessMatchVolatility,
  type MatchVolatilityReport,
} from "@/lib/probix-engine/match-volatility";
import {
  buildValueGateCandidate,
  evaluateValueGateCombo,
  type NoBetReason,
  type ValueGateDebug,
} from "@/lib/probix-engine/value-gate";
import type { ProbixLearningContext } from "@/lib/probix-evolution/types";

const TARGET_MIN = 2.0;
const TARGET_MAX = 2.3;

type Draft = {
  marketId: string;
  family: MarketFamily;
  group: string;
  label: string;
  selection: string;
  p: number;
  decimal: number;
  source: "bookmaker" | "synthetic_fallback";
  variance: number;
};

type AdjustedDraft = Draft & {
  rawP: number;
  calibratedP: number;
  reliabilityFactor: number;
  finalP: number;
  adjustedEdge: number;
  impliedP: number;
  marketReliabilityFactor: number;
  leagueReliabilityFactor: number;
  rejectedReasons: NoBetReason[];
  oddsMovementPct?: number;
  movedAgainstModel?: boolean;
  movedWithModel?: boolean;
};

function pct(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

function adjustDraftProbability(
  draft: Draft,
  fixture: NormalizedFixture,
  learning: ProbixLearningContext | null | undefined,
): AdjustedDraft {
  const gated = buildValueGateCandidate(
    {
      marketId: draft.marketId,
      family: draft.family,
      rawProbability: draft.p,
      decimal: draft.decimal,
      oddsSource: draft.source,
    },
    learning,
    fixture.leagueName,
  );

  const rejectedReasons = [...gated.rejectedReasons];
  const marketDisagreementPct =
    draft.source === "bookmaker" && gated.finalAdjustedProbability > 0
      ? ((gated.impliedProbability - gated.finalAdjustedProbability) /
          gated.finalAdjustedProbability) *
        100
      : 0;
  const movedAgainstModel = marketDisagreementPct > 8;
  const movedWithModel = marketDisagreementPct < -5;
  if (marketDisagreementPct > 15) {
    rejectedReasons.push("odds_moved_against_model");
  }
  const finalP =
    movedAgainstModel && marketDisagreementPct <= 15
      ? Math.max(0.05, gated.finalAdjustedProbability * 0.94)
      : movedWithModel
        ? Math.min(0.94, gated.finalAdjustedProbability * 1.025)
        : gated.finalAdjustedProbability;

  return {
    ...draft,
    rawP: gated.rawProbability,
    calibratedP: gated.calibratedProbability,
    reliabilityFactor: gated.reliabilityFactor,
    finalP,
    adjustedEdge: finalP - gated.impliedProbability,
    impliedP: gated.impliedProbability,
    marketReliabilityFactor: gated.marketReliabilityFactor,
    leagueReliabilityFactor: gated.leagueReliabilityFactor,
    rejectedReasons,
    oddsMovementPct: Number(marketDisagreementPct.toFixed(3)),
    movedAgainstModel,
    movedWithModel,
  };
}

function dec(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 1.01 && n < 30 ? n : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function oddsFor(
  odds: readonly SportmonksOdd[],
  marketId: number,
  matcher: (odd: SportmonksOdd) => boolean,
): number | null {
  return median(
    filterBookmakers(odds)
      .filter((o) => o.market_id === marketId && !o.stopped && matcher(o))
      .map((o) => dec(o.value ?? o.dp3))
      .filter((x): x is number => x != null),
  );
}

function predictionByType(predictions: readonly SportmonksPrediction[], typeId: number) {
  return predictions.find((p) => p.type_id === typeId);
}

function cleanDecimal(prob: number, real: number | null): { decimal: number; source: Draft["source"] } {
  if (real != null) return { decimal: Number(real.toFixed(2)), source: "bookmaker" };
  const synthetic = Math.max(1.08, Math.min(6, (1 / prob) * 0.94));
  return { decimal: Number(synthetic.toFixed(2)), source: "synthetic_fallback" };
}

function pushOu(
  out: Draft[],
  fixture: NormalizedFixture,
  typeId: number,
  line: string,
  predictions: readonly SportmonksPrediction[],
  team: "total" | "home" | "away",
) {
  const p = predictionByType(predictions, typeId);
  if (!p) return;
  const yes = pct(p.predictions.yes);
  const no = pct(p.predictions.no);
  const baseLabel =
    team === "home"
      ? `${fixture.homeName} goluri`
      : team === "away"
        ? `${fixture.awayName} goluri`
        : "Total goluri";
  const marketId = team === "total" ? 80 : 86;

  for (const side of [
    { key: "yes", prob: yes, total: `Over ${line}`, selection: `Peste ${line}` },
    { key: "no", prob: no, total: `Under ${line}`, selection: `Sub ${line}` },
  ]) {
    if (side.prob == null || side.prob < 0.58) continue;
    const real = oddsFor(
      fixture.sportmonksOdds ?? [],
      marketId,
      (o) =>
        (o.total ?? "").toLowerCase() === side.total.toLowerCase() &&
        (team === "total" ||
          (team === "home" ? o.label === "1" : o.label === "2")),
    );
    const priced = cleanDecimal(side.prob, real);
    out.push({
      marketId: `sm:${typeId}:${side.key}`,
      family: side.selection.startsWith("Peste") ? "goals_high" : "goals_low",
      group: `${team}-goals`,
      label: baseLabel,
      selection: side.selection,
      p: side.prob,
      decimal: priced.decimal,
      source: priced.source,
      variance: Number(line) >= 3.5 ? 0.16 : 0.08,
    });
  }
}

function buildDrafts(fixture: NormalizedFixture): Draft[] {
  const predictions = fixture.sportmonksPredictions ?? [];
  const odds = fixture.sportmonksOdds ?? [];
  const out: Draft[] = [];

  const btts = predictionByType(predictions, 231);
  if (btts) {
    for (const side of [
      { key: "yes", label: "Da", odd: "Yes" },
      { key: "no", label: "Nu", odd: "No" },
    ]) {
      const p = pct(btts.predictions[side.key]);
      if (p == null || p < 0.56) continue;
      const priced = cleanDecimal(
        p,
        oddsFor(odds, 14, (o) => (o.label ?? o.name ?? "").toLowerCase() === side.odd.toLowerCase()),
      );
      out.push({
        marketId: `sm:231:${side.key}`,
        family: "btts",
        group: "btts",
        label: "Ambele marcheaza",
        selection: side.label,
        p,
        decimal: priced.decimal,
        source: priced.source,
        variance: 0.12,
      });
    }
  }

  const ft = predictionByType(predictions, 237);
  if (ft) {
    for (const side of [
      { key: "home", label: fixture.homeName, odd: "Home" },
      { key: "draw", label: "Egal", odd: "Draw" },
      { key: "away", label: fixture.awayName, odd: "Away" },
    ]) {
      const p = pct(ft.predictions[side.key]);
      if (p == null || p < 0.42) continue;
      const priced = cleanDecimal(
        p,
        oddsFor(odds, 1, (o) => (o.label ?? o.name ?? "").toLowerCase() === side.odd.toLowerCase()),
      );
      out.push({
        marketId: `sm:237:${side.key}`,
        family: "result_safe",
        group: "result",
        label: "Rezultat final",
        selection: side.label,
        p,
        decimal: priced.decimal,
        source: priced.source,
        variance: side.key === "draw" ? 0.22 : 0.16,
      });
    }
  }

  const dc = predictionByType(predictions, 239);
  if (dc) {
    for (const side of [
      { key: "draw_home", label: "Gazde sau egal", odd: "Home/Draw" },
      { key: "home_away", label: "Gazde sau oaspeti", odd: "Home/Away" },
      { key: "draw_away", label: "Oaspeti sau egal", odd: "Draw/Away" },
    ]) {
      const p = pct(dc.predictions[side.key]);
      if (p == null || p < 0.6) continue;
      const priced = cleanDecimal(
        p,
        oddsFor(odds, 2, (o) => (o.label ?? o.name ?? "").toLowerCase() === side.odd.toLowerCase()),
      );
      out.push({
        marketId: `sm:239:${side.key}`,
        family: "result_safe",
        group: "result",
        label: "Sansa dubla",
        selection: side.label,
        p,
        decimal: priced.decimal,
        source: priced.source,
        variance: 0.05,
      });
    }
  }

  pushOu(out, fixture, 234, "1.5", predictions, "total");
  pushOu(out, fixture, 235, "2.5", predictions, "total");
  pushOu(out, fixture, 236, "3.5", predictions, "total");
  pushOu(out, fixture, 1679, "4.5", predictions, "total");
  pushOu(out, fixture, 334, "0.5", predictions, "home");
  pushOu(out, fixture, 331, "1.5", predictions, "home");
  pushOu(out, fixture, 333, "0.5", predictions, "away");
  pushOu(out, fixture, 332, "1.5", predictions, "away");

  return out.sort((a, b) => scoreDraft(b) - scoreDraft(a));
}

function scoreDraft(x: Draft | AdjustedDraft): number {
  const p = "finalP" in x ? x.finalP : x.p;
  const targetFit = 1 - Math.min(1, Math.abs(x.decimal - 1.55) / 3);
  const oddsQuality = x.source === "bookmaker" ? 0.08 : -0.04;
  return p * 0.7 + targetFit * 0.18 - x.variance + oddsQuality;
}

function combos<T>(items: T[], max = 3): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length) out.push([...acc]);
    if (acc.length >= max) return;
    for (let i = start; i < items.length; i++) {
      walk(i + 1, [...acc, items[i]]);
    }
  };
  walk(0, []);
  return out;
}

function compatible(combo: readonly Draft[]): boolean {
  const groups = new Set<string>();
  for (const pick of combo) {
    if (groups.has(pick.group)) return false;
    groups.add(pick.group);
  }
  return true;
}

function toCandidate(x: AdjustedDraft): MarketCandidate {
  return {
    marketId: x.marketId,
    family: x.family,
    label: x.label,
    selection: x.selection,
    p: x.rawP,
    calibratedProb: x.finalP,
    confidence: Math.max(0.45, Math.min(0.95, x.finalP - x.variance + (x.source === "bookmaker" ? 0.08 : 0))),
    estimatedDecimal: x.decimal,
    bookmakerDecimal: x.source === "bookmaker" ? x.decimal : undefined,
    bookmakerImpliedProb: x.source === "bookmaker" ? Number((1 / x.decimal).toFixed(4)) : undefined,
    edgeScore: Number(x.adjustedEdge.toFixed(4)),
    oddsSource: x.source,
    oddsMovementPct: x.oddsMovementPct,
    movedAgainstModel: x.movedAgainstModel,
    movedWithModel: x.movedWithModel,
    rationaleKeys: ["sportmonks_prediction", x.source],
    correlationTags: [x.group],
    probabilityDebug: {
      rawP: Number(x.rawP.toFixed(4)),
      calibratedP: Number(x.calibratedP.toFixed(4)),
      reliabilityFactor: Number(x.reliabilityFactor.toFixed(4)),
      finalP: Number(x.finalP.toFixed(4)),
      impliedP: Number(x.impliedP.toFixed(4)),
      edge: Number(x.adjustedEdge.toFixed(4)),
      marketReliabilityFactor: Number(x.marketReliabilityFactor.toFixed(4)),
      leagueReliabilityFactor: Number(x.leagueReliabilityFactor.toFixed(4)),
    },
  };
}

function noBetFromDebug(
  reason: NoBetReason,
  debug: ValueGateDebug,
  volatility?: MatchVolatilityReport,
): ProbixNoBetResult {
  return {
    kind: "no_bet",
    reason,
    outcome: "NO_BET",
    volatility,
    debug,
  };
}

function volatilityCandidateInput(drafts: readonly AdjustedDraft[]) {
  return drafts.map((x) => ({
    marketId: x.marketId,
    family: x.family,
    p: x.finalP,
    bookmakerImpliedProb:
      x.source === "bookmaker" ? Number((1 / x.decimal).toFixed(4)) : undefined,
    edgeScore: x.adjustedEdge,
    oddsSource: x.source,
  }));
}

function predictionOutcomeFromVolatility(
  report: MatchVolatilityReport,
  confidenceAvg: number,
): ProbixEngineOutput["predictionOutcome"] {
  if (report.shouldAvoid) return "VOLATILE_AVOID";
  if (report.level === "LOW" && confidenceAvg >= 0.72) return "SAFE_BET";
  return "MEDIUM_RISK";
}

export function buildSportmonksPredictionDecision(
  fixture: NormalizedFixture,
  learning?: ProbixLearningContext | null,
  opts?: {
    disableRiskGates?: boolean;
  },
): ProbixEngineOutput | ProbixNoBetResult {
  const rawDrafts = buildDrafts(fixture);
  const adjustedDrafts = rawDrafts
    .map((draft) => adjustDraftProbability(draft, fixture, learning))
    .sort((a, b) => scoreDraft(b) - scoreDraft(a));

  const familySampleSizes = learning
    ? adjustedDrafts.map((x) => {
        const dbg = buildValueGateCandidate(
          {
            marketId: x.marketId,
            family: x.family,
            rawProbability: x.rawP,
            decimal: x.decimal,
            oddsSource: x.source,
          },
          learning,
          fixture.leagueName,
        );
        return dbg.familySampleSize;
      })
    : [];

  const volatility = assessMatchVolatility({
    fixture,
    candidates: volatilityCandidateInput(adjustedDrafts),
    leagueReliabilityFactor: learning?.leagueProbFactor.get(fixture.leagueName),
    familySampleSizeMin: familySampleSizes.length
      ? Math.min(...familySampleSizes)
      : null,
  });

  if (volatility.shouldAvoid && !opts?.disableRiskGates) {
    return noBetFromDebug(
      "volatile_avoid",
      {
        rejectedCandidates: [],
        comboRejectedReason: "volatile_avoid",
      },
      volatility,
    );
  }

  const drafts = adjustedDrafts
    .filter((draft) => {
      return draft.rejectedReasons.length === 0;
    })
    .sort((a, b) => scoreDraft(b) - scoreDraft(a))
    .slice(0, 14);
  if (!drafts.length) {
    const rejectedCandidates = adjustedDrafts
      .map((x) => ({
        marketId: x.marketId,
        family: x.family,
        reasons: x.rejectedReasons.length ? x.rejectedReasons : (["insufficient_edge"] as NoBetReason[]),
        rawP: x.rawP,
        calibratedP: x.calibratedP,
        impliedP: x.impliedP,
        edge: x.adjustedEdge,
        marketReliabilityFactor: x.marketReliabilityFactor,
        leagueReliabilityFactor: x.leagueReliabilityFactor,
        finalP: x.finalP,
      }));
    return noBetFromDebug(
      rawDrafts.length ? "no_real_odds" : "insufficient_candidate_pool",
      {
        rejectedCandidates,
        comboRejectedReason: rawDrafts.length
          ? "no_real_odds"
          : "insufficient_candidate_pool",
      },
      volatility,
    );
  }

  let firstRejectedReason: NoBetReason | null = null;
  let firstRejectedDebug: ValueGateDebug | null = null;
  const maxComboLegs =
    volatility.shouldAllowOnlySingles && !opts?.disableRiskGates ? 1 : 3;

  const ranked = combos(drafts, maxComboLegs)
    .filter(compatible)
    .flatMap((combo) => {
      const comboType = (combo.length === 1 ? "single" : combo.length === 2 ? "double" : "triple") as ProbixComboType;
      const gate = evaluateValueGateCombo(
        combo.map((x) =>
          buildValueGateCandidate(
            {
              marketId: x.marketId,
              family: x.family,
              rawProbability: x.rawP,
              decimal: x.decimal,
              oddsSource: x.source,
            },
            learning,
            fixture.leagueName,
          ),
        ),
        comboType,
      );
      if (!gate.accepted) {
        firstRejectedReason ??= gate.reason;
        firstRejectedDebug ??= gate.debug;
        return [];
      }
      const decimal = combo.reduce((m, x) => m * x.decimal, 1);
      const probability = gate.comboProbability;
      const targetPenalty =
        decimal >= TARGET_MIN && decimal <= TARGET_MAX
          ? 0
          : Math.min(Math.abs(decimal - TARGET_MIN), Math.abs(decimal - TARGET_MAX)) * 0.16;
      const totalEdge = gate.totalEdge;
      const score =
        combo.reduce((s, x) => s + scoreDraft(x), 0) / combo.length -
        targetPenalty +
        (combo.length > 1 ? 0.03 : 0) +
        totalEdge * 0.12;
      return [{ combo, decimal, probability, score, totalEdge, valueGateDebug: gate.debug }];
    })
    .sort((a, b) => b.score - a.score);

  const selected =
    ranked.find((r) => r.decimal >= TARGET_MIN && r.decimal <= TARGET_MAX) ?? ranked[0];
  if (!selected) {
    return noBetFromDebug(
      firstRejectedReason ?? "insufficient_edge",
      firstRejectedDebug ?? { rejectedCandidates: [], comboRejectedReason: "insufficient_edge" },
    );
  }

  const picks = selected.combo.map(toCandidate);
  const confidenceAvg = picks.reduce((s, x) => s + x.confidence, 0) / picks.length;
  const comboType = (picks.length === 1 ? "single" : picks.length === 2 ? "double" : "triple") as ProbixComboType;

  return {
    picks,
    comboType,
    comboScore: Number(selected.score.toFixed(4)),
    comboProbability: Number(Math.min(0.98, selected.probability).toFixed(4)),
    totalEdge: Number(selected.totalEdge.toFixed(4)),
    confidenceScore: Math.round(confidenceAvg * 100),
    confidenceAvg,
    estimatedCombinedDecimal: Number(selected.decimal.toFixed(2)),
    riskRating: confidenceAvg >= 0.72 ? "low" : confidenceAvg >= 0.62 ? "medium" : "high",
    explanationBullets: [
      "Selectie din probabilitatile SportMonks, cu cote SportMonks agregate pe bookmakeri.",
      "Publicare doar cand probabilitatea ajustata depaseste probabilitatea implicita a cotelor.",
      "Value gate respinge cote sintetice, edge insuficient si combinatii corelate excesiv.",
      volatility.explanation,
    ],
    engineVersion: "sportmonks-predictions-v1",
    predictionOutcome: predictionOutcomeFromVolatility(volatility, confidenceAvg),
    volatility,
    valueGateDebug: selected.valueGateDebug,
  };
}

export function buildSportmonksPredictionOutput(
  fixture: NormalizedFixture,
  learning?: ProbixLearningContext | null,
): ProbixEngineOutput | null {
  const decision = buildSportmonksPredictionDecision(fixture, learning);
  return "kind" in decision ? null : decision;
}
