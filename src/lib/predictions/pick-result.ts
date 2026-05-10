import type { PredictionPick, PredictionSettlement } from "@/lib/predictions/types";
import type { NormalizedFixture } from "@/lib/football-api/types";

export type PickResult = "won" | "lost" | "pending" | "void";

function ceilHalfLine(line: number): number {
  return Math.ceil(line - 1e-9);
}

/**
 * Pentru UX pe card după **final** sau **live cu scor** (pentru goluri/BTTS/dc).
 * Cornere/fără date agregate rămân `pending` până există stats sau settlement backend.
 */
export function evaluatePickResult(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals"
  >,
  pick: PredictionPick,
  opts?: {
    cornersTotal?: number | null;
    cardsTotal?: number | null;
  },
): PickResult {
  const h = fixture.homeGoals;
  const a = fixture.awayGoals;
  const knownScore =
    fixture.bucket !== "upcoming" && h != null && a != null;
  const G = knownScore ? h + a : null;

  const finished = fixture.bucket === "finished";

  switch (pick.marketId) {
    case "goals_o15": {
      if (G === null) return "pending";
      return G >= 2 ? "won" : finished ? "lost" : "pending";
    }
    case "goals_o25": {
      if (G === null) return "pending";
      return G >= 3 ? "won" : finished ? "lost" : "pending";
    }
    case "goals_u25": {
      if (G === null) return "pending";
      return G <= 2 ? "won" : "lost";
    }
    case "btts_yes": {
      if (h == null || a == null) return "pending";
      return h >= 1 && a >= 1 ? "won" : finished ? "lost" : "pending";
    }
    case "dc_1x": {
      if (h == null || a == null) return "pending";
      return h >= a ? "won" : finished ? "lost" : "pending";
    }
    case "corners_o85": {
      const need = ceilHalfLine(8.5);
      const c = opts?.cornersTotal ?? null;
      if (c == null) return "pending";
      return c >= need ? "won" : finished ? "lost" : "pending";
    }
    case "corners_o95": {
      const need = ceilHalfLine(9.5);
      const c = opts?.cornersTotal ?? null;
      if (c == null) return "pending";
      return c >= need ? "won" : finished ? "lost" : "pending";
    }
    case "cards_o35": {
      const need = ceilHalfLine(3.5);
      const c = opts?.cardsTotal ?? null;
      if (c == null) return "pending";
      return c >= need ? "won" : finished ? "lost" : "pending";
    }
    default:
      return "pending";
  }
}

/** Deducere pentru tentă card dacă lipsesc `payload.settlement` dar meciul e final. */
export function deriveComboVisualSettlement(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals"
  >,
  picks: PredictionPick[] | undefined,
  backend: PredictionSettlement | undefined,
  opts?: { cornersTotal?: number | null; cardsTotal?: number | null },
): Exclude<PredictionSettlement, "pending"> | "pending" {
  if (backend && backend !== "pending") return backend;
  if (!picks?.length || fixture.bucket !== "finished") return "pending";

  const results = picks.map((p) => evaluatePickResult(fixture, p, opts));
  if (results.some((r) => r === "void")) return "void";
  if (results.some((r) => r === "pending")) return "pending";
  if (results.every((r) => r === "won")) return "won";
  return "lost";
}

/**
 * Piață și selecție (română), după `marketId`.
 * Pentru liste/UI preferă **`predictionPickLineRo`** ca text principal — evită „Da”/„Nu” fără context.
 *
 * Piațe suportate de motor și evaluare live/settlement:
 * - `goals_o15`, `goals_o25`, `goals_u25` — prag total goluri
 * - `btts_yes` — ambele echipe înscriu
 * - `corners_o85`, `corners_o95` — cornere totale prag
 * - `cards_o35` — galbene combinate prag
 * - `dc_1x` — șansă dublă 1X (gazda nu pierde)
 *
 * Fallback: etichetele din payload (`marketLabel`, `selection`).
 */
export function marketDisplayRo(pick: PredictionPick): {
  market: string;
  selection: string;
} {
  const id = pick.marketId;
  switch (id) {
    case "goals_o15":
      return { market: "Total goluri", selection: "Peste 1,5 goluri" };
    case "goals_o25":
      return { market: "Total goluri", selection: "Peste 2,5 goluri" };
    case "goals_u25":
      return { market: "Total goluri", selection: "Sub 2,5 goluri" };
    case "btts_yes":
      return {
        market: "Ambele echipe marchează",
        selection: "Minim un gol marcat de fiecare formație",
      };
    case "corners_o85":
      return {
        market: "Cornere (total în meci)",
        selection: "Peste 8,5 cornere",
      };
    case "corners_o95":
      return {
        market: "Cornere (total în meci)",
        selection: "Peste 9,5 cornere",
      };
    case "cards_o35":
      return {
        market: "Cartonașe galbene (combinat)",
        selection: "Peste 3,5 la ambele echipe cumulat",
      };
    case "dc_1x":
      return { market: "Șansă dublă", selection: "1 sau X — gazda nu pierde" };
    default:
      return {
        market: pick.marketLabel || "Piață",
        selection: pick.selection || "-",
      };
  }
}

/**
 * Linie unică pentru carduri/liste — mereu suficientă context (fără ambiguu „Da” singur).
 */
export function predictionPickLineRo(pick: PredictionPick): string {
  const id = pick.marketId ?? "";
  const ro = marketDisplayRo(pick);

  switch (id) {
    case "goals_o15":
    case "goals_o25":
    case "goals_u25":
      return ro.selection;
    case "btts_yes":
      return "Ambele echipe marchează (minim un gol marcat de fiecare)";
    case "corners_o85":
    case "corners_o95":
    case "cards_o35":
      return ro.selection;
    case "dc_1x":
      return ro.selection;
    default: {
      const market = pick.marketLabel || ro.market;
      const sel = (pick.selection || ro.selection).trim();
      if (!sel || sel === "-") return market;
      if (market && market !== sel) return `${market}: ${sel}`;
      return sel;
    }
  }
}
