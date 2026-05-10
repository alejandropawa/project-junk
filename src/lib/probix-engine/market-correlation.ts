/**
 * Încadrare pentru penalizări de corelație la selectarea combinației.
 * Preferă regex/prefix pentru piețe noi (goluri o/u, cornere, cartonașe, faulturi).
 */

export function isGoalsOverId(id: string): boolean {
  return id.startsWith("goals_o");
}

export function isGoalsUnderId(id: string): boolean {
  return id.startsWith("goals_u");
}

export function isHighGoalsFamily(id: string): boolean {
  return isGoalsOverId(id) || id === "btts_yes";
}

export function isLowGoalsFamily(id: string): boolean {
  return isGoalsUnderId(id) || id === "btts_no";
}

export function isCornersOverId(id: string): boolean {
  return id.startsWith("corners_o");
}

export function isCornersUnderId(id: string): boolean {
  return id.startsWith("corners_u");
}

export function isCardsOverId(id: string): boolean {
  return id.startsWith("cards_o");
}

export function isCardsUnderId(id: string): boolean {
  return id.startsWith("cards_u");
}

export function isFoulsOverId(id: string): boolean {
  return id.startsWith("fouls_o");
}

export function isFoulsUnderId(id: string): boolean {
  return id.startsWith("fouls_u");
}

export function isDoubleChanceId(id: string): boolean {
  return id.startsWith("dc_");
}

export function isCardsHighCorrelated(id: string): boolean {
  return isCardsOverId(id) || isCardsUnderId(id);
}
