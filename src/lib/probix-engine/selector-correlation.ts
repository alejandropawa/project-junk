import * as Corr from "@/lib/probix-engine/market-correlation";

const SCALE = 1.45;

const PAIR_KEY = (a: string, b: string) => (a < b ? `${a}||${b}` : `${b}||${a}`);

/** Penalizări suplimentare (matrice moale) — sumate cu structura de bază. */
const MATRIX_EXTRA: Record<string, number> = {};

function setPair(a: string, b: string, v: number) {
  MATRIX_EXTRA[PAIR_KEY(a, b)] = v;
}

setPair("btts_yes", "goals_o25", 0.18);
setPair("btts_yes", "goals_o35", 0.22);
setPair("btts_yes", "goals_o15", 0.09);
setPair("btts_no", "goals_u25", 0.1);
setPair("dc_1x", "goals_u25", 0.2);
setPair("dc_x2", "goals_u25", 0.2);
setPair("dc_12", "goals_u25", 0.12);
setPair("dc_1x", "goals_u35", 0.15);
setPair("dc_x2", "goals_u35", 0.15);
setPair("cards_o45", "fouls_o245", 0.2);
setPair("cards_o35", "fouls_o225", 0.17);
setPair("corners_o105", "goals_o25", 0.14);
setPair("corners_o115", "goals_o35", 0.16);
setPair("corners_o95", "goals_o25", 0.11);

export function softMatrixPenalty(a: string, b: string): number {
  return MATRIX_EXTRA[PAIR_KEY(a, b)] ?? 0;
}

/**
 * Penalizare structură între două piețe (0 = independent, ~0.45 = foarte corelate).
 */
export function pairwiseStructuralPenalty(a: string, b: string): number {
  const hA = Corr.isHighGoalsFamily(a);
  const hB = Corr.isHighGoalsFamily(b);
  const lA = Corr.isLowGoalsFamily(a);
  const lB = Corr.isLowGoalsFamily(b);
  const cA = Corr.isCardsHighCorrelated(a);
  const cB = Corr.isCardsHighCorrelated(b);
  const fA = Corr.isFoulsOverId(a) || Corr.isFoulsUnderId(a);
  const fB = Corr.isFoulsOverId(b) || Corr.isFoulsUnderId(b);
  const cnA = Corr.isCornersOverId(a) || Corr.isCornersUnderId(a);
  const cnB = Corr.isCornersOverId(b) || Corr.isCornersUnderId(b);

  let p = 0;
  if (hA && hB) p += 0.14 * SCALE;
  if (lA && lB) p += 0.12 * SCALE;
  if ((hA && lB) || (hB && lA)) p += 0.16 * SCALE;
  if (cA && cB) p += 0.13 * SCALE;
  if ((hA && cB) || (hB && cA)) p += 0.08 * SCALE;
  if (cnA && cnB) p += 0.1 * SCALE;
  if (fA && fB) p += 0.09 * SCALE;
  if ((cnA && fB) || (cnB && fA)) p += 0.14 * SCALE;
  if ((hA && cnB) || (hB && cnA)) p += 0.2 * SCALE;
  if ((lA && cnB) || (lB && cnA)) p += 0.15 * SCALE;

  const BTTS_YES = "btts_yes";
  const BTTS_NO = "btts_no";
  if (
    (a === BTTS_YES || b === BTTS_YES) &&
    (Corr.isGoalsOverId(a) || Corr.isGoalsOverId(b))
  ) {
    p += 0.1;
  }
  if (
    (a === BTTS_NO || b === BTTS_NO) &&
    (Corr.isGoalsUnderId(a) || Corr.isGoalsUnderId(b))
  ) {
    p += 0.08;
  }

  if (
    ((Corr.isDoubleChanceId(a) && Corr.isGoalsUnderId(b)) ||
      (Corr.isDoubleChanceId(b) && Corr.isGoalsUnderId(a))) &&
    !(Corr.isDoubleChanceId(a) && Corr.isDoubleChanceId(b))
  ) {
    p += 0.06;
  }

  const mat = softMatrixPenalty(a, b);
  return Math.min(0.56, p + mat);
}

export function comboStructuralPenaltySum(marketIds: string[]): number {
  let s = 0;
  for (let i = 0; i < marketIds.length; i++) {
    for (let j = 0; j < i; j++) {
      s += pairwiseStructuralPenalty(marketIds[i], marketIds[j]);
    }
  }
  return s;
}
