/** Familii pentru calibrare + încredere istorică. */
export type CalibrationFamilyKey =
  | "goals"
  | "corners"
  | "cards"
  | "fouls"
  | "btts"
  | "dc"
  | "unknown";

export function calibrationFamilyKeyFromMarketId(
  marketId: string,
): CalibrationFamilyKey {
  if (!marketId) return "unknown";
  if (marketId.startsWith("goals_")) return "goals";
  if (marketId.startsWith("corners_")) return "corners";
  if (marketId.startsWith("cards_")) return "cards";
  if (marketId.startsWith("fouls_")) return "fouls";
  if (marketId.startsWith("btts_")) return "btts";
  if (marketId.startsWith("dc_")) return "dc";
  return "unknown";
}
