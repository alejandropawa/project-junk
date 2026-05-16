import { filterBookmakers } from "@/lib/football-api/sportmonks";
import type { NormalizedFixture, SportmonksOdd } from "@/lib/football-api/types";
import type { PredictionPick } from "@/lib/predictions/types";

export type OddsMovementSignal = {
  openingOdds?: number;
  publishedOdds?: number;
  currentOdds?: number;
  closingOdds?: number;
  oddsMovementPct?: number;
  movedAgainstModel?: boolean;
  movedWithModel?: boolean;
  closingLineValuePct?: number;
};

function dec(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 1.01 && n < 30 ? n : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function oddsFor(
  odds: readonly SportmonksOdd[],
  marketId: number,
  matcher: (odd: SportmonksOdd) => boolean,
): number | null {
  return median(
    filterBookmakers(odds)
      .filter((o) => o.market_id === marketId && !o.stopped && matcher(o))
      .map((o) => dec(o.value ?? o.dp3))
      .filter((x): x is number => x != null),
  );
}

export function sportmonksOddsForPredictionPick(
  fixture: Pick<NormalizedFixture, "sportmonksOdds" | "homeName" | "awayName">,
  pick: Pick<PredictionPick, "marketId" | "selection">,
): number | null {
  const odds = fixture.sportmonksOdds ?? [];
  const marketId = pick.marketId ?? "";
  if (!marketId.startsWith("sm:")) return null;

  const [, typeIdRaw, side] = marketId.split(":");
  const typeId = Number(typeIdRaw);

  if (typeId === 231) {
    const label = side === "yes" ? "Yes" : side === "no" ? "No" : "";
    return oddsFor(
      odds,
      14,
      (o) => (o.label ?? o.name ?? "").toLowerCase() === label.toLowerCase(),
    );
  }

  if (typeId === 237) {
    const label =
      side === "home" ? "Home" : side === "draw" ? "Draw" : side === "away" ? "Away" : "";
    return oddsFor(
      odds,
      1,
      (o) => (o.label ?? o.name ?? "").toLowerCase() === label.toLowerCase(),
    );
  }

  if (typeId === 239) {
    const label =
      side === "draw_home"
        ? "Home/Draw"
        : side === "home_away"
          ? "Home/Away"
          : side === "draw_away"
            ? "Draw/Away"
            : "";
    return oddsFor(
      odds,
      2,
      (o) => (o.label ?? o.name ?? "").toLowerCase() === label.toLowerCase(),
    );
  }

  const lineByType: Record<number, string> = {
    234: "1.5",
    235: "2.5",
    236: "3.5",
    1679: "4.5",
    334: "0.5",
    331: "1.5",
    333: "0.5",
    332: "1.5",
  };
  const line = lineByType[typeId];
  if (line == null) return null;
  const total = side === "yes" ? `Over ${line}` : side === "no" ? `Under ${line}` : "";
  const team =
    typeId === 334 || typeId === 331
      ? "home"
      : typeId === 333 || typeId === 332
        ? "away"
        : "total";
  const market = team === "total" ? 80 : 86;

  return oddsFor(
    odds,
    market,
    (o) =>
      (o.total ?? "").toLowerCase() === total.toLowerCase() &&
      (team === "total" || (team === "home" ? o.label === "1" : o.label === "2")),
  );
}

export function calculateOddsMovement(
  openingOdds: number | null | undefined,
  currentOdds: number | null | undefined,
): OddsMovementSignal {
  if (
    openingOdds == null ||
    currentOdds == null ||
    !Number.isFinite(openingOdds) ||
    !Number.isFinite(currentOdds) ||
    openingOdds <= 1 ||
    currentOdds <= 1
  ) {
    return {};
  }

  const oddsMovementPct = ((currentOdds - openingOdds) / openingOdds) * 100;
  const closingLineValuePct = (openingOdds / currentOdds - 1) * 100;

  return {
    openingOdds: Number(openingOdds.toFixed(2)),
    publishedOdds: Number(openingOdds.toFixed(2)),
    currentOdds: Number(currentOdds.toFixed(2)),
    closingOdds: Number(currentOdds.toFixed(2)),
    oddsMovementPct: Number(oddsMovementPct.toFixed(3)),
    movedAgainstModel: closingLineValuePct < 0,
    movedWithModel: closingLineValuePct > 0,
    closingLineValuePct: Number(closingLineValuePct.toFixed(3)),
  };
}

