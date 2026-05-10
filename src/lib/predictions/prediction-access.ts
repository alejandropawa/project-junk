import type { PredictionPayload } from "@/lib/predictions/types";

/** Combinația are rezultat cunoscut (won/lost/void); safe pentru istoric „public”. */
export function isPredictionCombinationResolved(p: PredictionPayload): boolean {
  const s = p.settlement ?? "pending";
  return s === "won" || s === "lost" || s === "void";
}
