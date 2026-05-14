import type { PredictionPick, PredictionSettlement } from "@/lib/predictions/types";
import { isTerminalFixtureStatus } from "@/lib/football-api/bucket";
import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import type { NormalizedFixture } from "@/lib/football-api/types";

export type PickResult = "won" | "lost" | "pending" | "void";

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

function evaluateSportmonksPick(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit" | "statusShort"
  >,
  pick: PredictionPick,
  finished: boolean,
): PickResult | null {
  if (!pick.marketId?.startsWith("sm:")) return null;
  const [, typeIdRaw, side] = pick.marketId.split(":");
  const typeId = Number(typeIdRaw);
  const h = fixture.homeGoals;
  const a = fixture.awayGoals;
  if (h == null || a == null) return "pending";
  const total = h + a;

  const ouLineByType: Record<number, number> = {
    234: 1.5,
    235: 2.5,
    236: 3.5,
    1679: 4.5,
    334: 0.5,
    331: 1.5,
    333: 0.5,
    332: 1.5,
  };
  const line = ouLineByType[typeId];
  if (line != null) {
    const value =
      typeId === 334 || typeId === 331
        ? h
        : typeId === 333 || typeId === 332
          ? a
          : total;
    return evaluateHalfTotal(side === "yes", line, value, finished);
  }

  if (typeId === 231) {
    const yes = h >= 1 && a >= 1;
    if (side === "yes") return yes ? "won" : finished ? "lost" : "pending";
    return yes ? "lost" : finished ? "won" : "pending";
  }

  if (!finished) return "pending";
  if (typeId === 237) {
    const actual = h > a ? "home" : h < a ? "away" : "draw";
    return side === actual ? "won" : "lost";
  }
  if (typeId === 239) {
    if (side === "draw_home") return h >= a ? "won" : "lost";
    if (side === "draw_away") return a >= h ? "won" : "lost";
    if (side === "home_away") return h !== a ? "won" : "lost";
  }
  return null;
}

export function evaluatePickResult(
  fixture: Pick<
    NormalizedFixture,
    "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit" | "statusShort"
  >,
  pick: PredictionPick,
  opts?: LiveTotalsOpts,
): PickResult {
  const h = fixture.homeGoals;
  const a = fixture.awayGoals;
  const knownScore =
    fixture.bucket !== "upcoming" && h != null && a != null;
  const G = knownScore ? h + a : null;
  const finished =
    fixture.bucket === "finished" &&
    isTerminalFixtureStatus(fixture.statusShort);

  const sportmonksResult = evaluateSportmonksPick(fixture, pick, finished);
  if (sportmonksResult) return sportmonksResult;

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
    /** Șanse duble: rezultatul se validează doar la fluier (0–0 nu înseamnă 1X/X2 „câștigate” în timpul meciului). */
    case "dc_1x": {
      if (h == null || a == null) return "pending";
      if (!finished) return "pending";
      return h >= a ? "won" : "lost";
    }
    case "dc_x2": {
      if (h == null || a == null) return "pending";
      if (!finished) return "pending";
      return a >= h ? "won" : "lost";
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
    "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit" | "statusShort"
  >,
  picks: PredictionPick[] | undefined,
  backend: PredictionSettlement | undefined,
  opts?: LiveTotalsOpts,
): Exclude<PredictionSettlement, "pending"> | "pending" {
  if (backend && backend !== "pending") return backend;
  if (!picks?.length || fixture.bucket !== "finished") return "pending";
  if (!isTerminalFixtureStatus(fixture.statusShort)) return "pending";

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
