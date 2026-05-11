import {
  BOOK_COMBO_MIN_LEG_EDGE,
  COMBO_CORR_WEIGHT,
  COMBO_EDGE_WEIGHT,
  COMBO_PROB_WEIGHT,
  FINALIST_SCORE_NEAR_EPS,
  POOL_RANK_PROB_LEAN,
  SELECTION_AGG_WEIGHT,
  SELECTION_DATA_WEIGHT,
  SELECTION_EDGE_WEIGHT,
  SELECTION_PREF_WEIGHT,
  SELECTION_PROB_WEIGHT,
} from "@/lib/probix-engine/config";

/** Pachet complet de ponderi pentru `selectComboAndRisk` (override față de importuri directe). */
export type SelectionWeightBundle = {
  comboProbWeight: number;
  comboEdgeWeight: number;
  comboCorrWeight: number;
  selectionEdgeWeight: number;
  selectionProbWeight: number;
  poolRankProbLean: number;
  selectionDataWeight: number;
  selectionAggWeight: number;
  selectionPrefWeight: number;
  bookComboMinLegEdge: number;
  finalistScoreNearEps: number;
};

export function defaultSelectionWeightBundle(): SelectionWeightBundle {
  return {
    comboProbWeight: COMBO_PROB_WEIGHT,
    comboEdgeWeight: COMBO_EDGE_WEIGHT,
    comboCorrWeight: COMBO_CORR_WEIGHT,
    selectionEdgeWeight: SELECTION_EDGE_WEIGHT,
    selectionProbWeight: SELECTION_PROB_WEIGHT,
    poolRankProbLean: POOL_RANK_PROB_LEAN,
    selectionDataWeight: SELECTION_DATA_WEIGHT,
    selectionAggWeight: SELECTION_AGG_WEIGHT,
    selectionPrefWeight: SELECTION_PREF_WEIGHT,
    bookComboMinLegEdge: BOOK_COMBO_MIN_LEG_EDGE,
    finalistScoreNearEps: FINALIST_SCORE_NEAR_EPS,
  };
}

export type ProbixSelectionModeName =
  | "balanced"
  | "hit_rate"
  | "value"
  | "conservative";

/** Aliasuri env → nume canon (aggressive = value pentru politici piețe). */
export function resolveSelectionModeName(
  mode: string | undefined | null,
): ProbixSelectionModeName {
  const m = (mode ?? "balanced").trim().toLowerCase().replace(/-/g, "_");
  if (m === "hit_rate" || m === "hit_rate_first") return "hit_rate";
  if (m === "value" || m === "edge" || m === "aggressive") return "value";
  if (m === "conservative") return "conservative";
  return "balanced";
}

/**
 * Moduri de optimizare (env `PROBIX_SELECTION_MODE`).
 * - `balanced` — default din config.
 * - `hit_rate` — favorizează probabilitatea combinată (bilet care trece mai des).
 * - `value` — favorizează edge față de agent.
 * - `conservative` — edge minim mai strict pe combinații, prob dominantă.
 */
export function resolveSelectionWeightBundle(
  mode: string | undefined | null,
): SelectionWeightBundle {
  const b = defaultSelectionWeightBundle();
  const name = resolveSelectionModeName(mode);

  if (name === "hit_rate") {
    return {
      ...b,
      comboProbWeight: 0.6,
      comboEdgeWeight: 0.22,
      comboCorrWeight: 0.18,
      selectionProbWeight: 0.34,
      poolRankProbLean: 0.28,
      bookComboMinLegEdge: -0.028,
    };
  }

  if (name === "value") {
    return {
      ...b,
      comboProbWeight: 0.38,
      comboEdgeWeight: 0.4,
      comboCorrWeight: 0.22,
      selectionEdgeWeight: 0.52,
      selectionProbWeight: 0.26,
      poolRankProbLean: 0.16,
    };
  }

  if (name === "conservative") {
    return {
      ...b,
      comboProbWeight: 0.55,
      comboEdgeWeight: 0.24,
      comboCorrWeight: 0.21,
      bookComboMinLegEdge: -0.022,
      selectionAggWeight: 0.16,
    };
  }

  return b;
}
