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
    if (raw >= need) {
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
      detail: `${cur} / ${maxOk} ${u}`,
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
      detail: `${cur} / ${maxOk} ${u}`,
      ratio: Math.min(1, (maxOk - raw + (facet === "goals" ? 0.3 : 0.5)) / maxOk),
      status: "pending",
    });
  }
}

export type LiveProgressOpts = {
  cornersTotal?: number | null;
  cardsTotal?: number | null;
  foulsTotal?: number | null;
};

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
        else if (!finished)
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: 0.5,
            status: "pending",
          });
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
        else if (!finished)
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: 0.5,
            status: "pending",
          });
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
        else if (!finished)
          rows.push({
            id,
            label: baseLabel,
            detail: "",
            ratio: 0.5,
            status: "pending",
          });
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

  /** Pre-live: fără text auxiliar sub etichetă (la live datele sunt adesea 0, nu null — nu apare „nesincronizate”). */
  if (fixture.bucket === "upcoming") {
    return rows.map((r) => ({ ...r, detail: "" }));
  }

  return rows;
}
