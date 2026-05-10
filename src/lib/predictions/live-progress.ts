import { predictionPickLineRo } from "@/lib/predictions/pick-result";
import type { PredictionPick } from "@/lib/predictions/types";
import type { FixtureBucket } from "@/lib/football-api/types";

export type LiveProgressStatus =
  | "complete"
  | "pending"
  | "failed"
  | "awaiting_data";

export type LiveProgressRow = {
  id: string;
  label: string;
  /** Mesaj contextual (ex. 2 / 3, sau „În curs”). */
  detail: string;
  /** 0–1 pentru bară; null = indeterminate. */
  ratio: number | null;
  status: LiveProgressStatus;
};

type FixtureSlice = {
  bucket: FixtureBucket;
  homeGoals: number | null;
  awayGoals: number | null;
};

function goalsTotal(f: FixtureSlice): number | null {
  const { homeGoals: h, awayGoals: a } = f;
  if (h == null || a == null) return null;
  return h + a;
}

/** Peste X.5 → prag întreg (ex. 8.5 → 9). */
function ceilHalfLine(line: number): number {
  return Math.ceil(line - 1e-9);
}

function labelForPick(pick: PredictionPick): string {
  return predictionPickLineRo(pick);
}

/** Heuristici deterministic pentru UX de urmărire (nu evaluare contabilă). */
export function deriveLiveProgressRows(
  fixture: FixtureSlice,
  picks: PredictionPick[] | undefined,
  opts?: {
    cornersTotal?: number | null;
    cardsTotal?: number | null;
  },
): LiveProgressRow[] {
  if (!picks?.length || fixture.bucket === "upcoming") return [];

  const G = goalsTotal(fixture);
  const hk = fixture.homeGoals;
  const ak = fixture.awayGoals;

  const knownScore = hk != null && ak != null;

  const finished = fixture.bucket === "finished";

  const rows: LiveProgressRow[] = [];

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const id = pick.marketId ?? `pick_${i}_${pick.selection}`;
    const baseLabel = labelForPick(pick);

    switch (pick.marketId) {
      case "goals_o15": {
        const target = 2;
        if (!knownScore || G === null)
          rows.push({
            id,
            label: baseLabel,
            detail: `${target}+ goluri (total)`,
            ratio: null,
            status: "pending",
          });
        else if (G >= 2)
          rows.push({
            id,
            label: baseLabel,
            detail: `${Math.min(G, target)} / ${target} ✓`,
            ratio: 1,
            status: "complete",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${G} / ${target}${finished ? " ✕" : " · în curs"}`,
            ratio: Math.min(1, G / target),
            status: finished ? "failed" : "pending",
          });
        break;
      }
      case "goals_o25": {
        const target = 3;
        if (!knownScore || G === null)
          rows.push({
            id,
            label: baseLabel,
            detail: `${target}+ goluri`,
            ratio: null,
            status: "pending",
          });
        else if (G >= 3)
          rows.push({
            id,
            label: baseLabel,
            detail: `${Math.min(G, target)} / ${target} ✓`,
            ratio: 1,
            status: "complete",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${G} / ${target}${finished ? " ✕" : " · în curs"}`,
            ratio: Math.min(1, G / target),
            status: finished ? "failed" : "pending",
          });
        break;
      }
      case "goals_u25": {
        if (!knownScore || G === null)
          rows.push({
            id,
            label: baseLabel,
            detail: "Max. 2 goluri",
            ratio: null,
            status: "pending",
          });
        else if (G <= 2)
          rows.push({
            id,
            label: baseLabel,
            detail: `${G} goluri ✓`,
            ratio: 1,
            status: "complete",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${G} goluri ✕`,
            ratio: 0,
            status: "failed",
          });
        break;
      }
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
            detail: `${hk}–${ak} ✓`,
            ratio: 1,
            status: "complete",
          });
        else if (finished)
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak} ✕`,
            ratio: 0,
            status: "failed",
          });
        else {
          const progressed = hk >= 1 || ak >= 1 ? 0.45 : 0.08;
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak} · în curs`,
            ratio: progressed,
            status: "pending",
          });
        }
        break;
      }
      case "dc_1x": {
        if (!knownScore || hk == null || ak == null)
          rows.push({
            id,
            label: baseLabel,
            detail: "1 sau X",
            ratio: null,
            status: "pending",
          });
        else {
          const ok = hk >= ak;
          rows.push({
            id,
            label: baseLabel,
            detail: `${hk}–${ak}${ok ? " ✓" : finished ? " ✕" : " · în curs"}`,
            ratio: ok ? 1 : finished ? 0 : hk === ak ? 0.52 : hk > ak ? 0.85 : 0.15,
            status: ok ? "complete" : finished ? "failed" : "pending",
          });
        }
        break;
      }
      case "corners_o85":
      case "corners_o95": {
        const line = pick.marketId === "corners_o95" ? 9.5 : 8.5;
        const need = ceilHalfLine(line);
        const c = opts?.cornersTotal ?? null;
        if (c == null)
          rows.push({
            id,
            label: baseLabel,
            detail: `Linia ${line} · flux live nesincronizat`,
            ratio: null,
            status: "awaiting_data",
          });
        else if (c >= need)
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} ✓`,
            ratio: 1,
            status: "complete",
          });
        else if (finished)
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} ✕`,
            ratio: Math.min(1, c / need),
            status: "failed",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} · în curs`,
            ratio: Math.min(1, c / need),
            status: "pending",
          });
        break;
      }
      case "cards_o35": {
        const line = 3.5;
        const need = ceilHalfLine(line);
        const c = opts?.cardsTotal ?? null;
        if (c == null)
          rows.push({
            id,
            label: baseLabel,
            detail: `Linie cartonașe ${line} · flux nesincronizat`,
            ratio: null,
            status: "awaiting_data",
          });
        else if (c >= need)
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} ✓`,
            ratio: 1,
            status: "complete",
          });
        else if (finished)
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} ✕`,
            ratio: Math.min(1, c / need),
            status: "failed",
          });
        else
          rows.push({
            id,
            label: baseLabel,
            detail: `${c} / ${need} · în curs`,
            ratio: Math.min(1, c / need),
            status: "pending",
          });
        break;
      }
      default:
        rows.push({
          id,
          label: baseLabel,
          detail: fixture.bucket === "live" ? "În curs" : "În monitorizare",
          ratio: null,
          status: "pending",
        });
    }
  }

  return rows;
}
