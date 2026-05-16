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
  if (marketId.startsWith("sm:")) {
    const [, typeId] = marketId.split(":");
    if (typeId === "231") return "btts";
    if (typeId === "237" || typeId === "239") return "dc";
    if (
      typeId === "234" ||
      typeId === "235" ||
      typeId === "236" ||
      typeId === "1679" ||
      typeId === "331" ||
      typeId === "332" ||
      typeId === "333" ||
      typeId === "334"
    ) {
      return "goals";
    }
  }
  if (marketId.startsWith("goals_")) return "goals";
  if (marketId.startsWith("corners_")) return "corners";
  if (marketId.startsWith("cards_")) return "cards";
  if (marketId.startsWith("fouls_")) return "fouls";
  if (marketId.startsWith("btts_")) return "btts";
  if (marketId.startsWith("dc_")) return "dc";
  return "unknown";
}
