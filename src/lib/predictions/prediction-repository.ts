import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import type { PredictionPayload } from "@/lib/predictions/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "prediction_reports";

export type PredictionRepoRow = {
  fixture_id: number;
  date_ro: string;
  payload: PredictionPayload;
};

/** Rând complet din `prediction_reports` (istoric / afișare). */
export type PredictionReportRow = {
  fixture_id: number;
  date_ro: string;
  home_name: string;
  away_name: string;
  league_name: string;
  kickoff_iso: string;
  payload: PredictionPayload;
};

export async function predictionExists(
  sb: SupabaseClient,
  fixtureId: number,
  dateRo: string,
): Promise<boolean> {
  const { count, error } = await sb
    .from(TABLE)
    .select("fixture_id", { count: "exact", head: true })
    .eq("fixture_id", fixtureId)
    .eq("date_ro", dateRo);
  if (error) return false;
  return (count ?? 0) > 0;
}

export type UpsertPredictionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function upsertPrediction(
  sb: SupabaseClient,
  row: {
    fixture_id: number;
    date_ro: string;
    home_name: string;
    away_name: string;
    league_name: string;
    kickoff_iso: string;
    payload: PredictionPayload;
  },
): Promise<UpsertPredictionResult> {
  const { error } = await sb.from(TABLE).upsert(
    {
      fixture_id: row.fixture_id,
      date_ro: row.date_ro,
      home_name: row.home_name,
      away_name: row.away_name,
      league_name: row.league_name,
      kickoff_iso: row.kickoff_iso,
      payload: row.payload,
    },
    { onConflict: "fixture_id,date_ro" },
  );
  if (error)
    return { ok: false, error: `${error.code ?? "?"} ${error.message}`.trim() };
  return { ok: true };
}

export async function fetchPredictionsForDate(
  sb: SupabaseClient,
  dateRo: string,
): Promise<Map<number, PredictionPayload>> {
  const { data, error } = await sb
    .from(TABLE)
    .select("fixture_id,payload")
    .eq("date_ro", dateRo);

  const out = new Map<number, PredictionPayload>();
  // Tabel inexistent / RLS / neautentificat → nimic în map (fără crash UI).
  if (error || !data) return out;
  for (const r of data as { fixture_id: number; payload: PredictionPayload }[]) {
    /** Bigint în Postgres poate ajunge uneori ca string în JSON API. */
    const id =
      typeof r.fixture_id === "string"
        ? Number(r.fixture_id)
        : Number(r.fixture_id);
    if (!Number.isFinite(id)) continue;
    out.set(id, r.payload);
  }
  return out;
}

function pickPayloadForFixtureRows(
  rows: { date_ro: string; payload: PredictionPayload }[],
  pageDateRo?: string,
): PredictionPayload | null {
  if (rows.length === 0) return null;
  const withPicks = rows.filter((r) => (r.payload.picks?.length ?? 0) > 0);
  const pool = withPicks.length > 0 ? withPicks : rows;
  if (pageDateRo) {
    const exact = pool.find((r) => r.date_ro === pageDateRo);
    if (exact) return exact.payload;
  }
  const sorted = [...pool].sort((a, b) => b.date_ro.localeCompare(a.date_ro));
  return sorted[0]?.payload ?? null;
}

/**
 * Predicții pentru meciurile din listă, indiferent de `date_ro` din DB.
 * Rezolvă cazul în care `prediction_reports.date_ro` ≠ ziua paginii (ex. trecere mieznoapte / reîncadrare API).
 */
export async function fetchPredictionsForFixtureIds(
  sb: SupabaseClient,
  fixtureIds: readonly number[],
  pageDateRo?: string,
): Promise<Map<number, PredictionPayload>> {
  const ids = [
    ...new Set(
      fixtureIds.filter((id) => typeof id === "number" && id > 0 && Number.isFinite(id)),
    ),
  ];
  const out = new Map<number, PredictionPayload>();
  if (ids.length === 0) return out;

  const { data, error } = await sb
    .from(TABLE)
    .select("fixture_id,date_ro,payload")
    .in("fixture_id", ids);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[probix] fetchPredictionsForFixtureIds:",
        error.message,
        error.code,
      );
    }
    return out;
  }
  if (!data) return out;

  const byFixture = new Map<
    number,
    { date_ro: string; payload: PredictionPayload }[]
  >();

  for (const r of data as {
    fixture_id: number | string;
    date_ro: string;
    payload: PredictionPayload;
  }[]) {
    const fid =
      typeof r.fixture_id === "string"
        ? Number(r.fixture_id)
        : Number(r.fixture_id);
    if (!Number.isFinite(fid)) continue;
    const list = byFixture.get(fid) ?? [];
    list.push({ date_ro: r.date_ro, payload: r.payload });
    byFixture.set(fid, list);
  }

  for (const [fid, rows] of byFixture) {
    const payload = pickPayloadForFixtureRows(rows, pageDateRo);
    if (payload != null) out.set(fid, payload);
  }

  return out;
}

export async function fetchPredictionReportRowsForDate(
  sb: SupabaseClient,
  dateRo: string,
): Promise<PredictionReportRow[]> {
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "fixture_id,date_ro,home_name,away_name,league_name,kickoff_iso,payload",
    )
    .eq("date_ro", dateRo)
    .order("kickoff_iso", { ascending: true });

  if (error || !data) return [];
  return data as PredictionReportRow[];
}

export async function fetchDistinctPredictionDatesRo(
  sb: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await sb.from(TABLE).select("date_ro");
  if (error || !data?.length) return [];
  const set = new Set<string>();
  for (const r of data as { date_ro: string }[]) {
    if (r.date_ro) set.add(r.date_ro);
  }
  return [...set].sort();
}

/** Zile unde există cel puțin o predicție cu combinație rezolvată - pentru vizitatori (istoric public). */
export async function fetchDistinctPredictionDateRosResolvedPublic(
  sb: SupabaseClient,
): Promise<string[]> {
  const page = 500;
  const set = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(TABLE)
      .select("date_ro,payload")
      .range(from, from + page - 1);
    if (error || !data?.length) break;
    for (const r of data as { date_ro: string; payload: PredictionPayload }[]) {
      if (isPredictionCombinationResolved(r.payload) && r.date_ro) set.add(r.date_ro);
    }
    if ((data as unknown[]).length < page) break;
    from += page;
  }
  return [...set].sort();
}

/** Rânduri ușoare pentru probix-evolution (ligă + payload JSON). */
export async function fetchPredictionReportsForLearning(
  sb: SupabaseClient,
  maxRows = 6_000,
): Promise<{ league_name: string; payload: PredictionPayload }[]> {
  const page = 500;
  const out: { league_name: string; payload: PredictionPayload }[] = [];
  let from = 0;
  for (;;) {
    if (out.length >= maxRows) break;
    const { data, error } = await sb
      .from(TABLE)
      .select("league_name,payload")
      .range(from, from + page - 1);
    if (error) break;
    const rows =
      data as { league_name: string; payload: PredictionPayload }[] | null;
    if (!rows?.length) break;
    for (const r of rows) {
      if (out.length >= maxRows) break;
      if (r.league_name && r.payload) out.push({ league_name: r.league_name, payload: r.payload });
    }
    if (rows.length < page) break;
    from += page;
  }
  return out;
}

/**
 * Șterge tot istoricul `prediction_reports` (operațiune drastică — folosit după redeploy dacă ceri regenerare masivă).
 * Filtru tautologic sigur pentru PostgREST: `fixture_id >= 0`.
 */
export async function deleteAllPredictionReports(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await sb.from(TABLE).delete().gte("fixture_id", 0);
  if (error)
    return { ok: false, error: `${error.code ?? "?"} ${error.message}`.trim() };
  return { ok: true };
}

/** Toate rândurile din `prediction_reports` (paginat) — pentru job-uri admin / migrări. */
export async function fetchAllPredictionReportRows(
  sb: SupabaseClient,
): Promise<PredictionReportRow[]> {
  const page = 400;
  const out: PredictionReportRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(TABLE)
      .select(
        "fixture_id,date_ro,home_name,away_name,league_name,kickoff_iso,payload",
      )
      .order("date_ro", { ascending: false })
      .order("kickoff_iso", { ascending: false })
      .range(from, from + page - 1);
    if (error || !data?.length) break;
    out.push(...(data as PredictionReportRow[]));
    if ((data as unknown[]).length < page) break;
    from += page;
  }
  return out;
}

export async function fetchAllPredictionPayloadsForMetrics(
  sb: SupabaseClient,
): Promise<PredictionPayload[]> {
  const page = 1000;
  const out: PredictionPayload[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(TABLE)
      .select("payload")
      .range(from, from + page - 1);
    if (error) break;
    const rows = data as { payload: PredictionPayload }[] | null;
    if (!rows?.length) break;
    for (const r of rows) out.push(r.payload);
    if (rows.length < page) break;
    from += page;
  }
  return out;
}
