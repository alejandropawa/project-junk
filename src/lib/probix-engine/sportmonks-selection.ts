import { filterBookmakers } from "@/lib/football-api/sportmonks";
import type {
  NormalizedFixture,
  SportmonksOdd,
  SportmonksPrediction,
} from "@/lib/football-api/types";
import type {
  MarketCandidate,
  MarketFamily,
  ProbixComboType,
  ProbixEngineOutput,
} from "@/lib/probix-engine/types";

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

function pct(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
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

function scoreDraft(x: Draft): number {
  const targetFit = 1 - Math.min(1, Math.abs(x.decimal - 1.55) / 3);
  const oddsQuality = x.source === "bookmaker" ? 0.08 : -0.04;
  return x.p * 0.7 + targetFit * 0.18 - x.variance + oddsQuality;
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

function toCandidate(x: Draft): MarketCandidate {
  return {
    marketId: x.marketId,
    family: x.family,
    label: x.label,
    selection: x.selection,
    p: x.p,
    calibratedProb: x.p,
    confidence: Math.max(0.45, Math.min(0.95, x.p - x.variance + (x.source === "bookmaker" ? 0.08 : 0))),
    estimatedDecimal: x.decimal,
    bookmakerDecimal: x.source === "bookmaker" ? x.decimal : undefined,
    bookmakerImpliedProb: x.source === "bookmaker" ? Number((1 / x.decimal).toFixed(4)) : undefined,
    edgeScore: Number((x.p - 1 / x.decimal).toFixed(4)),
    oddsSource: x.source,
    rationaleKeys: ["sportmonks_prediction", x.source],
    correlationTags: [x.group],
  };
}

export function buildSportmonksPredictionOutput(
  fixture: NormalizedFixture,
): ProbixEngineOutput | null {
  const drafts = buildDrafts(fixture).slice(0, 14);
  if (!drafts.length) return null;

  const ranked = combos(drafts, 3)
    .filter(compatible)
    .map((combo) => {
      const decimal = combo.reduce((m, x) => m * x.decimal, 1);
      const probability = combo.reduce((m, x) => m * x.p, 1) * Math.pow(0.96, combo.length - 1);
      const targetPenalty =
        decimal >= TARGET_MIN && decimal <= TARGET_MAX
          ? 0
          : Math.min(Math.abs(decimal - TARGET_MIN), Math.abs(decimal - TARGET_MAX)) * 0.16;
      const score =
        combo.reduce((s, x) => s + scoreDraft(x), 0) / combo.length -
        targetPenalty +
        (combo.length > 1 ? 0.03 : 0);
      return { combo, decimal, probability, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected =
    ranked.find((r) => r.decimal >= TARGET_MIN && r.decimal <= TARGET_MAX) ?? ranked[0];
  if (!selected) return null;

  const picks = selected.combo.map(toCandidate);
  const confidenceAvg = picks.reduce((s, x) => s + x.confidence, 0) / picks.length;
  const comboType = (picks.length === 1 ? "single" : picks.length === 2 ? "double" : "triple") as ProbixComboType;

  return {
    picks,
    comboType,
    comboScore: Number(selected.score.toFixed(4)),
    comboProbability: Number(Math.min(0.98, selected.probability).toFixed(4)),
    totalEdge: Number(
      picks.reduce((s, x) => s + (x.edgeScore ?? 0), 0).toFixed(4),
    ),
    confidenceScore: Math.round(confidenceAvg * 100),
    confidenceAvg,
    estimatedCombinedDecimal: Number(selected.decimal.toFixed(2)),
    riskRating: confidenceAvg >= 0.72 ? "low" : confidenceAvg >= 0.62 ? "medium" : "high",
    explanationBullets: [
      "Selectie din probabilitatile SportMonks, cu cote SportMonks agregate pe bookmakeri.",
      "Combinatia cauta intervalul 2.00-2.30 si evita piete redundante din aceeasi familie.",
      "Prioritate pentru probabilitati ridicate, sansa dubla, linii joase si varianta mai mica.",
    ],
    engineVersion: "sportmonks-predictions-v1",
  };
}
