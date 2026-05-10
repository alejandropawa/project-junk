import { poissonPmf } from "@/lib/probix-engine/poisson-tail";

const MAX_G = 12;

/**
 * Rezultat 1X2 din două Poisson independente (aprox. rapidă, deterministă).
 */
export function matchWinDrawAwayProbs(
  lambdaHome: number,
  lambdaAway: number,
): { pHome: number; pDraw: number; pAway: number } {
  const lh = Math.max(0.15, lambdaHome);
  const la = Math.max(0.15, lambdaAway);
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let i = 0; i <= MAX_G; i++) {
    for (let j = 0; j <= MAX_G; j++) {
      const p = poissonPmf(i, lh) * poissonPmf(j, la);
      if (i > j) pHome += p;
      else if (i < j) pAway += p;
      else pDraw += p;
    }
  }
  const s = pHome + pDraw + pAway;
  if (s < 1e-9) return { pHome: 1 / 3, pDraw: 1 / 3, pAway: 1 / 3 };
  return {
    pHome: pHome / s,
    pDraw: pDraw / s,
    pAway: pAway / s,
  };
}
