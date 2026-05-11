import type { CalibrationBin, PickObservation } from "@/lib/probix-evolution/types";

const BIN = 0.1;

/**
 * Calibrare empirică: media prognozată vs rata reală pe intervale de probabilitate model.
 */
export function buildCalibrationBins(
  obs: readonly PickObservation[],
): CalibrationBin[] {
  if (!obs.length) return [];
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < 10; i++) {
    const binMin = i * BIN;
    const binMax = i === 9 ? 1.0001 : (i + 1) * BIN;
    const set = obs.filter(
      (o) => o.modelProb >= binMin - 1e-9 && o.modelProb < binMax,
    );
    if (!set.length) continue;
    const meanPredicted =
      set.reduce((s, x) => s + x.modelProb, 0) / set.length;
    const meanOutcome = set.filter((x) => x.won).length / set.length;
    bins.push({
      binMin,
      binMax: i === 9 ? 1 : binMax,
      count: set.length,
      meanPredicted,
      meanOutcome,
      gap: meanOutcome - meanPredicted,
    });
  }
  return bins;
}
