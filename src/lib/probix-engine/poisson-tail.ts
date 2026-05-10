/** Probabilități Poisson deterministic (total goluri / cornere etc.). */

export function poissonLogPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 0 : Number.NEGATIVE_INFINITY;
  if (k < 0) return Number.NEGATIVE_INFINITY;
  let lf = 0;
  for (let i = 2; i <= k; i++) lf += Math.log(i);
  return k * Math.log(lambda) - lambda - lf;
}

export function poissonPmf(k: number, lambda: number): number {
  const lx = poissonLogPmf(k, lambda);
  return Number.isFinite(lx) && lx > -80 ? Math.exp(lx) : 0;
}

/** P(X >= minK) unde X ~ Poisson(lambda), minK întreg ≥ 0 */
export function poissonTailAtLeast(minK: number, lambda: number): number {
  if (!Number.isFinite(lambda) || lambda < 1e-6) return minK <= 0 ? 1 : 0;
  if (minK <= 0) return 1;
  let cdf = 0;
  let maxScan = Math.min(40, Math.max(minK + 35, Math.ceil(lambda + 8 * Math.sqrt(lambda))));
  for (let k = 0; k < minK; k++) cdf += poissonPmf(k, lambda);
  return Number.isFinite(cdf) ? Math.min(1, Math.max(0, 1 - cdf)) : 0;
}

/** P(X <= maxK) unde X ~ Poisson(lambda). */
export function poissonTailAtMost(maxK: number, lambda: number): number {
  if (!Number.isFinite(lambda) || lambda < 1e-6) return maxK >= 0 ? 1 : 0;
  if (maxK < 0) return 0;
  let cdf = 0;
  const maxScan = Math.min(
    42,
    Math.max(maxK + 12, Math.ceil(lambda + 8 * Math.sqrt(lambda))),
  );
  const limit = Math.min(maxK, maxScan);
  for (let k = 0; k <= limit; k++) cdf += poissonPmf(k, lambda);
  return Math.min(1, Math.max(0, cdf));
}
