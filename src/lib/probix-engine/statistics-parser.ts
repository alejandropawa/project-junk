import type { TeamProfile } from "@/lib/probix-engine/types";

function pickNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const x = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

/** Parcurgere tolerantă către căi frecvente în răspunsul /teams/statistics. */
export function unpackStatsBody(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const res = j.response;
  if (Array.isArray(res) && res[0] && typeof res[0] === "object") {
    return res[0] as Record<string, unknown>;
  }
  if (res && typeof res === "object") {
    return res as Record<string, unknown>;
  }
  return null;
}

function formWdl(form: unknown): { w: number; d: number; l: number } {
  if (typeof form !== "string") return { w: 0, d: 0, l: 0 };
  let w = 0;
  let d = 0;
  let l = 0;
  for (const ch of form.slice(-5).toUpperCase()) {
    if (ch === "W") w += 1;
    else if (ch === "D") d += 1;
    else if (ch === "L") l += 1;
  }
  return { w, d, l };
}

/** Extrage mediile din blocuri `{ total: number|string, home:| away:}` sau sub-chei. */
function avgTriplet(block: unknown): {
  total: number;
  home: number;
  away: number;
} {
  const d =
    block && typeof block === "object"
      ? (block as Record<string, unknown>)
      : {};

  let total =
    pickNum(d.total) ??
    pickNum(d.all) ??
    pickNum(typeof d.overall === "object" ? pickNum((d.overall as { total?: unknown }).total) : null);
  let home =
    pickNum(d.home) ??
    (typeof d.home === "object"
      ? pickNum((d.home as { total?: unknown }).total)
      : null);
  let away =
    pickNum(d.away) ??
    (typeof d.away === "object"
      ? pickNum((d.away as { total?: unknown }).total)
      : null);

  if (typeof d.average === "object") {
    const avg = d.average as Record<string, unknown>;
    total = total ?? pickNum(avg.total) ?? pickNum(avg.overall);
    home = home ?? pickNum(avg.home);
    away = away ?? pickNum(avg.away);
  }

  total = total ?? 0;
  home = home ?? total;
  away = away ?? total;
  return { total, home, away };
}

/** Procentaje din structuri `{ total: X, percentage: string }`. */
function percentageBlock(block: unknown): number | null {
  const d =
    block && typeof block === "object"
      ? (block as Record<string, unknown>)
      : null;
  if (!d) return null;
  const pct = pickNum(
    typeof d.percentage === "string"
      ? d.percentage.replace("%", "")
      : d.percentage,
  );
  if (pct != null) return pct / 100;
  return null;
}

export function parseTeamStatistics(
  teamId: number,
  payload: Record<string, unknown>,
): TeamProfile {
  const fixtures = payload.fixtures as Record<string, unknown> | undefined;
  const playedRaw = fixtures?.played as Record<string, unknown> | undefined;
  const playedTotal = Math.max(
    1,
    Math.round(pickNum(playedRaw?.total) ?? pickNum(fixtures?.played) ?? 1),
  );
  const rawHomePlayed =
    pickNum((playedRaw?.home as { total?: unknown })?.total) ??
    pickNum(playedRaw?.home as unknown);
  const rawAwayPlayed =
    pickNum((playedRaw?.away as { total?: unknown })?.total) ??
    pickNum(playedRaw?.away as unknown);

  let playedHome = rawHomePlayed != null ? Math.round(rawHomePlayed) : 0;
  let playedAway = rawAwayPlayed != null ? Math.round(rawAwayPlayed) : 0;

  playedHome =
    Number.isFinite(playedHome) && playedHome >= 1
      ? playedHome
      : Math.max(1, Math.floor(playedTotal / 2));
  playedAway =
    Number.isFinite(playedAway) && playedAway >= 1
      ? playedAway
      : Math.max(1, playedTotal - playedHome);

  const goals = payload.goals as Record<string, unknown> | undefined;
  const gf = avgTriplet(goals?.for);
  const ga = avgTriplet(goals?.against);

  const form = payload.form;

  let cornersAvg: number | null = null;
  const corners = payload.corners as Record<string, unknown> | undefined;
  if (corners) cornersAvg = pickNum((corners.for as Record<string, unknown>)?.average) ??
    avgTriplet(corners.for).total;

  const cards = payload.cards as Record<string, unknown> | undefined;
  let yellowAvg: number | null = null;
  let redAvg: number | null = null;
  const yellowBlk = cards?.yellow;
  const redBlk = cards?.red;
  if (typeof yellowBlk === "object") {
    yellowAvg = avgTriplet(yellowBlk).total;
    if (yellowAvg === 0) yellowAvg = pickNum((yellowBlk as { average?: unknown }).average);
  }
  if (typeof redBlk === "object") {
    redAvg = avgTriplet(redBlk).total;
  }

  const heuristicCleanSheetPct = (): number =>
    Math.min(
      0.55,
      Math.max(
        0.06,
        0.38 - gf.total * 0.05 - ga.total * 0.06 + (playedTotal > 0 ? 0.02 : 0),
      ),
    );
  const heuristicFailScorePct = (): number =>
    Math.min(
      0.52,
      Math.max(
        0.08,
        0.32 - gf.total * 0.06 + ga.total * 0.045,
      ),
    );

  const shots = payload.shots as Record<string, unknown> | undefined;
  const on = shots?.on as Record<string, unknown> | undefined;
  const totalShots =
    shots && typeof shots === "object" ? avgTriplet(shots).total : 0;
  let sotAvg: number | null = null;
  if (on && typeof on === "object") sotAvg = avgTriplet(on).total ?? null;

  const possessionSrc =
    (payload.ball_possession as Record<string, unknown> | undefined) ??
    (payload.possession as Record<string, unknown> | undefined);
  let possessionAvg: number | null = null;
  if (possessionSrc && typeof possessionSrc === "object") {
    const ap = avgTriplet(possessionSrc);
    let x = ap.total;
    if (!(x > 0)) {
      x = ap.home > 0 && ap.away > 0 ? (ap.home + ap.away) / 2 : 0;
    }
    if (x > 0 && x <= 1) x *= 100;
    possessionAvg = x > 0 && x <= 100 ? x : null;
  }

  return {
    teamId,
    playedTotal,
    playedHome,
    playedAway,
    goalsForAvgTotal: gf.total,
    goalsAgainstAvgTotal: ga.total,
    goalsForAvgHome: gf.home,
    goalsForAvgAway: gf.away,
    goalsAgainstAvgHome: ga.home,
    goalsAgainstAvgAway: ga.away,
    formLast5Wdl: formWdl(form),
    cornersForAvg: cornersAvg,
    yellowAvg,
    redAvg,
    shotsOnTargetForAvg: sotAvg,
    shotsTotalForAvg: totalShots > 0 ? totalShots : null,
    possessionAvg,
    cleanSheetPct:
      percentageBlock(
        payload.clean_sheet as Record<string, unknown> | undefined,
      ) ?? heuristicCleanSheetPct(),
    failedToScorePct: heuristicFailScorePct(),
  };
}

export function deriveProfileFromIncomplete(
  teamId: number,
  partial?: Partial<TeamProfile>,
): TeamProfile {
  return {
    teamId,
    playedTotal: Math.max(1, partial?.playedTotal ?? 10),
    playedHome: partial?.playedHome ?? 5,
    playedAway: partial?.playedAway ?? 5,
    goalsForAvgTotal: partial?.goalsForAvgTotal ?? 1.25,
    goalsAgainstAvgTotal: partial?.goalsAgainstAvgTotal ?? 1.15,
    goalsForAvgHome: partial?.goalsForAvgHome ?? partial?.goalsForAvgTotal ?? 1.25,
    goalsForAvgAway: partial?.goalsForAvgAway ?? partial?.goalsForAvgTotal ?? 1.2,
    goalsAgainstAvgHome:
      partial?.goalsAgainstAvgHome ?? partial?.goalsAgainstAvgTotal ?? 1.1,
    goalsAgainstAvgAway:
      partial?.goalsAgainstAvgAway ?? partial?.goalsAgainstAvgTotal ?? 1.15,
    formLast5Wdl: partial?.formLast5Wdl ?? { w: 2, d: 2, l: 1 },
    cornersForAvg: partial?.cornersForAvg ?? null,
    yellowAvg: partial?.yellowAvg ?? null,
    redAvg: partial?.redAvg ?? null,
    shotsOnTargetForAvg: partial?.shotsOnTargetForAvg ?? null,
    shotsTotalForAvg: partial?.shotsTotalForAvg ?? null,
    possessionAvg: partial?.possessionAvg ?? null,
    cleanSheetPct: partial?.cleanSheetPct ?? 0.2,
    failedToScorePct: partial?.failedToScorePct ?? 0.22,
  };
}
