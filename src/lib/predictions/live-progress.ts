import { isTerminalFixtureStatus } from "@/lib/football-api/bucket";
import { predictionPickLineRo } from "@/lib/predictions/pick-result";
import type { PredictionPick } from "@/lib/predictions/types";
import { parseTotalsOuMarketId } from "@/lib/probix-engine/total-market-id";
import type { NormalizedFixture } from "@/lib/football-api/types";

export type LiveProgressStatus =
  | "complete"
  | "pending"
  | "failed"
  | "awaiting_data";

export type LiveProgressRow = {
  id: string;
  label: string;
  detail: string;
  ratio: number | null;
  status: LiveProgressStatus;
};

type FixtureSlice = Pick<
  NormalizedFixture,
  "bucket" | "homeGoals" | "awayGoals" | "liveStatsSplit" | "statusShort"
>;

function goalsTotal(f: FixtureSlice): number | null {
  const { homeGoals: h, awayGoals: a } = f;
  if (h == null || a == null) return null;
  return h + a;
}

function ceilHalfLine(line: number): number {
  return Math.ceil(line - 1e-9);
}

const PROGRESS_EPS = 1e-9;

function foulsLive(f: FixtureSlice): number | null {
  const h = f.liveStatsSplit?.home.fouls;
  const a = f.liveStatsSplit?.away.fouls;
  if (h == null || a == null) return null;
  return h + a;
}

function facetStat(
  facet: "goals" | "corners" | "cards" | "fouls",
  G: number | null,
  f: FixtureSlice,
  opts?: LiveProgressOpts,
): number | null {
  switch (facet) {
    case "goals":
      return G;
    case "corners":
      return opts?.cornersTotal ?? null;
    case "cards":
      return opts?.cardsTotal ?? null;
    case "fouls":
      return opts?.foulsTotal ?? foulsLive(f) ?? null;
    default:
      return null;
  }
}

function unitRo(
  facet: "goals" | "corners" | "cards" | "fouls",
): string {
  switch (facet) {
    case "goals":
      return "goluri";
    case "corners":
      return "cornere";
    case "cards":
      return "cart.";
    case "fouls":
      return "faulturi";
    default:
      return "";
  }
}

function pushHalfOuProgressRow(
  rows: LiveProgressRow[],
  id: string,
  baseLabel: string,
  facet: "goals" | "corners" | "cards" | "fouls",
  over: boolean,
  line: number,
  raw: number | null,
  finished: boolean,
): void {
  const u = unitRo(facet);
  if (raw == null) {
    rows.push({
      id,
      label: baseLabel,
      detail: `Linia ${line} · date ${u} nesincronizate`,
      ratio: null,
      status: facet === "goals" ? "pending" : "awaiting_data",
    });
    return;
  }

  if (over) {
    const need = ceilHalfLine(line);
    if (raw + PROGRESS_EPS >= need) {
      rows.push({
        id,
        label: baseLabel,
        /** Stare doar în UI (Progres selecții); fără text duplicat aici. */
        detail: "",
        ratio: 1,
        status: "complete",
      });
    } else if (finished) {
      const cur = Math.round(raw);
      rows.push({
        id,
        label: baseLabel,
        detail: `${cur} / ${need} ${u}`,
        ratio: Math.min(1, raw / Math.max(1, need)),
        status: "failed",
      });
    } else {
      const cur = Math.round(raw);
      rows.push({
        id,
        label: baseLabel,
        detail: `${cur} / ${need} ${u}`,
        ratio: Math.min(1, raw / Math.max(1, need)),
        status: "pending",
      });
    }
    return;
  }

  const maxOk = Math.floor(line + 1e-9);
  if (raw > maxOk) {
    const cur = Math.round(raw);
    rows.push({
      id,
      label: baseLabel,
      detail: `${cur} ${u} (limită ${maxOk})`,
      ratio: 0,
      status: "failed",
    });
  } else if (finished) {
    rows.push({
      id,
      label: baseLabel,
      detail: "",
      ratio: 1,
      status: "complete",
    });
  } else {
    const cur = Math.round(raw);
    rows.push({
      id,
      label: baseLabel,
      detail: `${cur} ${u} (limită ${maxOk})`,
      ratio: 0.5,
      status: "pending",
    });
  }
}

export type LiveProgressOpts = {
  cornersTotal?: number | null;
  cardsTotal?: number | null;
  foulsTotal?: number | null;
};

function pushSportmonksProgressRow(
  rows: LiveProgressRow[],
  id: string,
  baseLabel: string,
  fixture: FixtureSlice,
  typeId: number,
  side: string,
  finished: boolean,
): boolean {
  const hk = fixture.homeGoals;
  const ak = fixture.awayGoals;
  const knownScore = hk != null && ak != null;
  if (!knownScore || hk == null || ak == null) {
    rows.push({
      id,
      label: baseLabel,
      detail: "",
      ratio: 0,
      status: "pending",
    });
    return true;
  }

  const total = hk + ak;
  const scoreDetail = `${hk}-${ak}`;
  const ouLineByType: Record<number, { line: number; value: number; unit: string }> = {
    234: { line: 1.5, value: total, unit: "goluri" },
    235: { line: 2.5, value: total, unit: "goluri" },
    236: { line: 3.5, value: total, unit: "goluri" },
    1679: { line: 4.5, value: total, unit: "goluri" },
    334: { line: 0.5, value: hk, unit: "goluri gazde" },
    331: { line: 1.5, value: hk, unit: "goluri gazde" },
    333: { line: 0.5, value: ak, unit: "goluri oaspeți" },
    332: { line: 1.5, value: ak, unit: "goluri oaspeți" },
  };

  const ou = ouLineByType[typeId];
  if (ou) {
    const before = rows.length;
    pushHalfOuProgressRow(
      rows,
      id,
      baseLabel,
      "goals",
      side === "yes",
      ou.line,
      ou.value,
      finished,
    );
    const last = rows[before];
    if (last && ou.unit !== "goluri") {
      last.detail = last.detail.replace("goluri", ou.unit);
      if (!last.detail && last.status === "complete" && side === "yes") {
        const need = ceilHalfLine(ou.line);
        last.detail = `${Math.round(ou.value)} / ${need} ${ou.unit}`;
      }
      if (last.status === "pending" && side === "no") {
        const maxOk = Math.floor(ou.line + 1e-9);
        last.detail = `${Math.round(ou.value)} ${ou.unit} (limită ${maxOk})`;
      }
    }
    return true;
  }

  if (typeId === 231) {
    const yesNow = hk >= 1 && ak >= 1;
    const pickYes = side === "yes";
    const won = pickYes ? yesNow : !yesNow && finished;
    const lost = pickYes ? finished && !yesNow : yesNow;
    rows.push({
      id,
      label: baseLabel,
      detail: won ? "" : scoreDetail,
      ratio: won ? 1 : lost ? 0 : yesNow ? 0 : hk >= 1 || ak >= 1 ? 0.45 : 0.08,
      status: won ? "complete" : lost ? "failed" : "pending",
    });
    return true;
  }

  if (typeId === 237) {
    if (!finished) {
      const leadsNow =
        side === "home" ? hk > ak : side === "away" ? ak > hk : hk === ak;
      rows.push({
        id,
        label: baseLabel,
        detail: scoreDetail,
        ratio: leadsNow ? 0.55 : 0.2,
        status: "pending",
      });
      return true;
    }
    const actual = hk > ak ? "home" : hk < ak ? "away" : "draw";
    const ok = side === actual;
    rows.push({
      id,
      label: baseLabel,
      detail: ok ? "" : scoreDetail,
      ratio: ok ? 1 : 0,
      status: ok ? "complete" : "failed",
    });
    return true;
  }

  if (typeId === 239) {
    const okNow =
      side === "draw_home"
        ? hk >= ak
        : side === "draw_away"
          ? ak >= hk
          : side === "home_away"
            ? hk !== ak
            : false;
    if (!finished) {
      rows.push({
        id,
        label: baseLabel,
        detail: "",
        ratio: okNow ? 0.5 : 0,
        status: "pending",
      });
      return true;
    }
    rows.push({
      id,
      label: baseLabel,
      detail: okNow ? "" : scoreDetail,
      ratio: okNow ? 1 : 0,
      status: okNow ? "complete" : "failed",
    });
    return true;
  }

  return false;
}

function labelForPick(pick: PredictionPick): string {
  return predictionPickLineRo(pick);
}

export function deriveLiveProgressRows(
  fixture: FixtureSlice,
  picks: PredictionPick[] | undefined,
  opts?: LiveProgressOpts,
): LiveProgressRow[] {
  if (!picks?.length) return [];

  const G = goalsTotal(fixture);
  const hk = fixture.homeGoals;
  const ak = fixture.awayGoals;

  const knownScore = hk != null && ak != null;

  const finished =
    fixture.bucket === "finished" &&
    isTerminalFixtureStatus(fixture.statusShort);

  const rows: LiveProgressRow[] = [];

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const id = pick.marketId ?? `pick_${i}_${pick.selection}`;
    const baseLabel = labelForPick(pick);

    if (pick.marketId?.startsWith("sm:")) {
      const [, typeIdRaw, side] = pick.marketId.split(":");
      const typeId = Number(typeIdRaw);
      if (
        Number.isFinite(typeId) &&
        pushSportmonksProgressRow(
          rows,
          id,
          baseLabel,
          fixture,
          typeId,
          side,
          finished,
        )
      ) {
        continue;
      }
    }

    const spec = pick.marketId
      ? parseTotalsOuMarketId(pick.marketId)
      : null;
    if (spec) {
      const raw = facetStat(spec.facet, G, fixture, opts);
      pushHalfOuProgressRow(
        rows,
        id,
        baseLabel,
        spec.facet,
        spec.over,
        spec.line,
        raw,
        finished,
      );
      continue;
    }

    switch (pick.marketId) {
      case "btts_yes": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "Ambele echipe trebuie să marcheze",
            ratio: null,
            status: "pending",
          });
        else if (hk >= 1 && ak >= 1)
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: 1,
            status: "complete",
          });
        else if (finished)
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak}`,
            ratio: 0,
            status: "failed",
          });
        else {
          const progressed = hk >= 1 || ak >= 1 ? 0.45 : 0.08;
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak}`,
            ratio: progressed,
            status: "pending",
          });
        }
        break;
      }
      case "btts_no": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "Aștept final sau „fără BTTS”",
            ratio: null,
            status: "pending",
          });
        else if (hk >= 1 && ak >= 1)
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak}`,
            ratio: 0,
            status: "failed",
          });
        else if (finished)
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: 1,
            status: "complete",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak}`,
            ratio: 0.35,
            status: "pending",
          });
        break;
      }
      /** Șansă dublă / rezultat la fluier: bară 50% până la final; 100% câștig, 50% eșec. */
      case "dc_1x": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "1X",
            ratio: 0.5,
            status: "pending",
          });
        else if (!finished) {
          // Dacă scorul curent ar pierde selecția, arătăm 0% (altfel 50% până la final).
          const okNow = hk >= ak; // 1X ⇒ gazda nu pierde
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: okNow ? 0.5 : 0,
            status: "pending",
          });
        }
        else {
          const ok = hk >= ak;
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: ok ? 1 : 0.5,
            status: ok ? "complete" : "failed",
          });
        }
        break;
      }
      case "dc_x2": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "X2",
            ratio: 0.5,
            status: "pending",
          });
        else if (!finished) {
          const okNow = ak >= hk; // X2 ⇒ oaspeții nu pierd
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: okNow ? 0.5 : 0,
            status: "pending",
          });
        }
        else {
          const ok = ak >= hk;
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: ok ? 1 : 0.5,
            status: ok ? "complete" : "failed",
          });
        }
        break;
      }
      case "dc_12": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "12 — rezultat la final",
            ratio: 0.5,
            status: "pending",
          });
        else if (!finished) {
          // 12 ⇒ fără egal la fluier. Dacă acum e egal, ar pierde selecția dacă s-ar termina acum.
          const okNow = hk !== ak;
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: okNow ? 0.5 : 0,
            status: "pending",
          });
        }
        else {
          const ok = hk !== ak;
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: ok ? 1 : 0.5,
            status: ok ? "complete" : "failed",
          });
        }
        break;
      }
      default:
        rows.push({
          id,
          label: baseLabel,
          detail: "",
          /** Piețe tip rezultat necunoscute în motor — același neutral ca șanse duble până avem logică dedicată. */
          ratio: 0.5,
          status: "pending",
        });
    }
  }

  /**
   * Pre-live:
   * - fără text auxiliar sub etichetă
   * - toate barele pornesc de la 0% (inclusiv 1X / X2 / 12 etc.)
   */
  if (fixture.bucket === "upcoming") {
    return rows.map((r) => {
      if (r.status === "complete" || r.status === "failed") {
        return { ...r, detail: "" };
      }
      return {
        ...r,
        detail: "",
        status: "pending",
        ratio: 0,
      };
    });
  }

  return rows;
}
