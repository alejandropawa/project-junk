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
