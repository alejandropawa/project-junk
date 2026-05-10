import type { PredictionPick, PredictionSettlement } from "@/lib/predictions/types";
import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import type { NormalizedFixture } from "@/lib/football-api/types";

export type PickResult = "won" | "lost" | "pending" | "void";

function ceilHalfLine(line: number): number {
  return Math.ceil(line - 1e-9);
}

function halfLineDecimalRo(line: number): string {
  return String(line).replace(".", ",");
}

export type LiveTotalsOpts = {
  cornersTotal?: number | null;
  cardsTotal?: number | null;
  foulsTotal?: number | null;
};

function foulsFromFixture(
  f: Pick<NormalizedFixture, "liveStatsSplit">,
): number | null {
  const s = f.liveStatsSplit;
  if (!s) return null;
  const h = s.home.fouls;
  const a = s.away.fouls;
  if (h == null || a == null) return null;
  return h + a;
}

function facetTotalValue(
  facet: "goals" | "corners" | "cards" | "fouls",
  G: number | null,
  fixture: Pick<NormalizedFixture, "liveStatsSplit">,
  opts?: LiveTotalsOpts,
): number | null {
  switch (facet) {
    case "goals":
      return G;
    case "corners":
      return opts?.cornersTotal ?? null;
    case "cards":
      return opts?.cardsTotal ?? null;
    case "fouls":
      return opts?.foulsTotal ?? foulsFromFixture(fixture) ?? null;
    default:
      return null;
  }
}

function evaluateHalfTotal(
  over: boolean,
  line: number,
  value: number | null,
  finished: boolean,
): PickResult {
  if (value == null) return "pending";

  if (over) {
    const need = Math.floor(line + 1e-9) + 1;
    if (value >= need) return "won";
    return finished ? "lost" : "pending";
  }

  const maxOk = Math.floor(line + 1e-9);
  if (value > maxOk) return "lost";
  return finished ? "won" : "pending";
}

export function evaluatePickResult(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit"
  >,
  pick: PredictionPick,
  opts?: LiveTotalsOpts,
): PickResult {
  const h = fixture.homeGoals;
  const a = fixture.awayGoals;
  const knownScore =
    fixture.bucket !== "upcoming" && h != null && a != null;
  const G = knownScore ? h + a : null;
  const finished = fixture.bucket === "finished";

  const spec = pick.marketId ? parseTotalsOuMarketId(pick.marketId) : null;
  if (spec) {
    const v = facetTotalValue(spec.facet, G, fixture, opts);
    return evaluateHalfTotal(spec.over, spec.line, v, finished);
  }

  switch (pick.marketId) {
    case "btts_yes": {
      if (h == null || a == null) return "pending";
      return h >= 1 && a >= 1 ? "won" : finished ? "lost" : "pending";
    }
    case "btts_no": {
      if (h == null || a == null) return "pending";
      if (h >= 1 && a >= 1) return "lost";
      return finished ? "won" : "pending";
    }
    case "dc_1x": {
      if (h == null || a == null) return "pending";
      return h >= a ? "won" : finished ? "lost" : "pending";
    }
    case "dc_x2": {
      if (h == null || a == null) return "pending";
      return a >= h ? "won" : finished ? "lost" : "pending";
    }
    case "dc_12": {
      if (h == null || a == null) return "pending";
      if (!finished) return "pending";
      return h !== a ? "won" : "lost";
    }
    default:
      return "pending";
  }
}

export function deriveComboVisualSettlement(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit"
  >,
  picks: PredictionPick[] | undefined,
  backend: PredictionSettlement | undefined,
  opts?: LiveTotalsOpts,
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
 * Piață și selecție UX; piețele totale O/U sunt generate dinamic din `marketId`.
 *
 * Piațe: goluri/cornere/cartonașe/faulturi (o/u + zecimi), BTTS da/nu, șanse duble 1X / X2 / 12.
 */
export function marketDisplayRo(pick: PredictionPick): {
  market: string;
  selection: string;
} {
  const spec = pick.marketId ? parseTotalsOuMarketId(pick.marketId) : null;
  if (spec) {
    const l = halfLineDecimalRo(spec.line);
    const facetMk =
      spec.facet === "goals"
        ? "Total goluri"
        : spec.facet === "corners"
          ? "Cornere în meci"
          : spec.facet === "cards"
            ? "Cartonașe galbene (combinat)"
            : "Faulturi în meci";
    const sel =
      spec.facet === "goals"
        ? spec.over
          ? `Peste ${l} goluri (total)`
          : `Sub ${l} goluri (total)`
        : spec.facet === "corners"
          ? spec.over
            ? `Peste ${l} cornere`
            : `Sub ${l} cornere`
          : spec.facet === "cards"
            ? spec.over
              ? `Peste ${l} cartonașe galbene (comb.)`
              : `Sub ${l} cartonașe galbene (comb.)`
            : spec.over
              ? `Peste ${l} faulturi (comb.)`
              : `Sub ${l} faulturi (comb.)`;
    return { market: facetMk, selection: sel };
  }

  switch (pick.marketId) {
    case "btts_yes":
      return {
        market: "Ambele echipe marchează",
        selection: "Da — minim un gol pentru fiecare",
      };
    case "btts_no":
      return {
        market: "Ambele echipe marchează",
        selection: "Nu — cel puțin o echipă fără gol",
      };
    case "dc_1x":
      return {
        market: "Șansă dublă",
        selection: "1X — gazda nu pierde",
      };
    case "dc_x2":
      return { market: "Șansă dublă", selection: "X2 — oaspeții nu pierd" };
    case "dc_12":
      return {
        market: "Șansă dublă",
        selection: "12 — fără egal",
      };
    default:
      return {
        market: pick.marketLabel || "Piață",
        selection: pick.selection || "-",
      };
  }
}

/** Linie principală pentru listă (explicită pentru utilizator). */
export function predictionPickLineRo(pick: PredictionPick): string {
  const spec = pick.marketId ? parseTotalsOuMarketId(pick.marketId) : null;
  if (spec) {
    const l = halfLineDecimalRo(spec.line);
    const what =
      spec.facet === "goals"
        ? "goluri"
        : spec.facet === "corners"
          ? "cornere"
          : spec.facet === "cards"
            ? "cartonașe galbene (comb.)"
            : "faulturi (comb.)";
    return spec.over
      ? `Peste ${l} ${what} — total în meci`
      : `Sub ${l} ${what} — total în meci`;
  }

  const ro = marketDisplayRo(pick);
  switch (pick.marketId) {
    case "btts_yes":
      return "Ambele echipe marchează (minim un gol marcat de fiecare)";
    case "btts_no":
      return "Nu marchează ambele echipe (cel puțin una fără gol la final)";
    case "dc_1x":
    case "dc_x2":
    case "dc_12":
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
