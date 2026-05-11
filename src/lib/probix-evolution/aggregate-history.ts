import type { PredictionCalibrationOutcome } from "@/lib/predictions/types";
import { calibrationFamilyKeyFromMarketId } from "@/lib/probix-evolution/market-family";
import type { PickObservation } from "@/lib/probix-evolution/observation-types";
import type { PredictionReportLite } from "@/lib/probix-evolution/types";

export const MIN_MARKET_SAMPLES_FOR_SCALE = 200;

export const MIN_LEAGUE_SAMPLES_FOR_FACTOR = 350;

/** Bloc dur doar pentru eșantioane mari. */
export const HARD_BLOCK_LEAGUE_MIN_SAMPLES = 1200;

const MIN_SAMPLES_ANY_LEARNING = 120;

/** Familie: suficient istoric pentru un factor Bayesian. */
const MIN_FAMILY_SAMPLES = 120;

function outcomeForPick(
  outcome: PredictionCalibrationOutcome | undefined,
  marketId: string | undefined,
): "won" | "lost" | void {
  if (!outcome?.pickResults?.length || !marketId) return;
  const r = outcome.pickResults.find((x) => x.marketId === marketId);
  if (!r || r.result === "pending") return;
  if (r.result === "void") return;
  if (r.result === "won" || r.result === "lost") return r.result;
  return;
}

export function extractPickObservations(
  rows: readonly PredictionReportLite[],
): PickObservation[] {
  const out: PickObservation[] = [];
  for (const row of rows) {
    const p = row.payload;
    const co = p.calibrationOutcome;
    if (!co) continue;
    const picks = p.picks;
    if (!picks?.length) continue;

    for (const pk of picks) {
      const mid = pk.marketId?.trim();
      if (!mid) continue;
      const res = outcomeForPick(co, mid);
      if (res !== "won" && res !== "lost") continue;
      const mp = pk.modelProb;
      if (mp == null || !Number.isFinite(mp)) continue;
      out.push({
        marketId: mid,
        leagueName: row.league_name,
        modelProb: mp,
        won: res === "won",
        oddsSource: pk.oddsSource,
      });
    }
  }
  return out;
}

function betaShrink(
  wins: number,
  n: number,
  globalP: number | null,
  priorK: number,
): number {
  if (n <= 0) return globalP ?? 0.45;
  const g = globalP ?? wins / n;
  return (wins + priorK * g) / (n + priorK);
}

export function aggregateByMarket(obs: readonly PickObservation[]): Map<
  string,
  { n: number; wins: number; avgP: number }
> {
  const m = new Map<string, { wins: number; sumP: number; n: number }>();
  for (const o of obs) {
    const cur = m.get(o.marketId) ?? { wins: 0, sumP: 0, n: 0 };
    cur.n += 1;
    cur.sumP += o.modelProb;
    if (o.won) cur.wins += 1;
    m.set(o.marketId, cur);
  }
  const out = new Map<string, { n: number; wins: number; avgP: number }>();
  for (const [k, v] of m) {
    out.set(k, {
      n: v.n,
      wins: v.wins,
      avgP: v.n > 0 ? v.sumP / v.n : 0,
    });
  }
  return out;
}

export function aggregateByLeague(obs: readonly PickObservation[]): Map<
  string,
  { n: number; wins: number }
> {
  const m = new Map<string, { wins: number; n: number }>();
  for (const o of obs) {
    const ln = o.leagueName?.trim();
    if (!ln) continue;
    const cur = m.get(ln) ?? { wins: 0, n: 0 };
    cur.n += 1;
    if (o.won) cur.wins += 1;
    m.set(ln, cur);
  }
  return m;
}

export function globalPickHitRate(
  obs: readonly PickObservation[],
): number | null {
  if (!obs.length) return null;
  const w = obs.filter((x) => x.won).length;
  return w / obs.length;
}

/** Per `marketId` — necesită eșantion mare per piață. */
export function buildMarketReliabilityScale(
  obs: readonly PickObservation[],
  opts?: {
    priorK?: number;
    minSamples?: number;
    multMin?: number;
    multMax?: number;
    gain?: number;
  },
): Map<string, number> {
  const priorK = opts?.priorK ?? 10;
  const minSamples = opts?.minSamples ?? MIN_MARKET_SAMPLES_FOR_SCALE;
  const multMin = opts?.multMin ?? 0.86;
  const multMax = opts?.multMax ?? 1.1;
  const gain = opts?.gain ?? 2.2;
  const g = globalPickHitRate(obs);
  const byM = aggregateByMarket(obs);
  const out = new Map<string, number>();
  for (const [mid, u] of byM) {
    if (u.n < minSamples) {
      out.set(mid, 1);
      continue;
    }
    const shrunk = betaShrink(u.wins, u.n, g, priorK);
    const base = g ?? u.wins / u.n;
    const delta = shrunk - base;
    const mult = 1 + gain * delta;
    out.set(mid, Math.min(multMax, Math.max(multMin, mult)));
  }
  return out;
}

/** Factor moale ligă după istoric suficient (~350). */
export function buildLeagueProbFactors(
  obs: readonly PickObservation[],
  opts?: {
    priorK?: number;
    minSamples?: number;
    factorMin?: number;
    factorMax?: number;
  },
): Map<string, number> {
  const priorK = opts?.priorK ?? 14;
  const minSamples = opts?.minSamples ?? MIN_LEAGUE_SAMPLES_FOR_FACTOR;
  const factorMin = opts?.factorMin ?? 0.76;
  const factorMax = opts?.factorMax ?? 1.08;
  const g = globalPickHitRate(obs);
  const byL = aggregateByLeague(obs);
  const out = new Map<string, number>();
  for (const [name, u] of byL) {
    if (u.n < minSamples) {
      out.set(name, 1);
      continue;
    }
    const shrunk = betaShrink(u.wins, u.n, g, priorK);
    const base = Math.max(0.32, g ?? shrunk);
    const ratio = shrunk / base;
    const f = 0.82 + 0.26 * Math.min(1.45, Math.max(0.62, ratio));
    out.set(name, Math.min(factorMax, Math.max(factorMin, f)));
  }
  return out;
}

/** Reziliență istorică per familie (Bayesian shrink). */
export function buildFamilyReliabilityScale(
  obs: readonly PickObservation[],
): Map<string, number> {
  const g = globalPickHitRate(obs);
  const grp = new Map<string, PickObservation[]>();
  for (const o of obs) {
    const f = calibrationFamilyKeyFromMarketId(o.marketId);
    if (f === "unknown") continue;
    const arr = grp.get(f) ?? [];
    arr.push(o);
    grp.set(f, arr);
  }
  const out = new Map<string, number>();
  const priorK = 14;
  for (const [fam, slice] of grp) {
    if (slice.length < MIN_FAMILY_SAMPLES) {
      out.set(fam, 1);
      continue;
    }
    const wins = slice.filter((x) => x.won).length;
    const shrunk = betaShrink(wins, slice.length, g, priorK);
    const base = Math.max(0.34, g ?? shrunk);
    const ratio = shrunk / base;
    const mult = 0.88 + 0.22 * Math.min(1.35, Math.max(0.68, ratio));
    out.set(fam, Math.min(1.09, Math.max(0.86, mult)));
  }
  return out;
}

export function buildHardBlockedLeagueNames(
  obs: readonly PickObservation[],
  opts?: {
    minSamples?: number;
    maxShrunkHit?: number;
    requireGlobalAbove?: number;
    priorK?: number;
  },
): Set<string> {
  const minSamples =
    opts?.minSamples ?? HARD_BLOCK_LEAGUE_MIN_SAMPLES;
  const maxShrunkHit = opts?.maxShrunkHit ?? 0.31;
  const requireGlobalAbove = opts?.requireGlobalAbove ?? 0.42;
  const priorK = opts?.priorK ?? 14;
  const g = globalPickHitRate(obs);
  if (g == null || g < requireGlobalAbove) return new Set();

  const byL = aggregateByLeague(obs);
  const blocked = new Set<string>();
  for (const [name, u] of byL) {
    if (u.n < minSamples) continue;
    const shrunk = betaShrink(u.wins, u.n, g, priorK);
    if (shrunk < maxShrunkHit) blocked.add(name);
  }
  return blocked;
}

export function hasMinimumLearningObservations(obs: PickObservation[]): boolean {
  return obs.length >= MIN_SAMPLES_ANY_LEARNING;
}
