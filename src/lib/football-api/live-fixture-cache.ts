import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FixtureLiveStatsSplit,
  FixtureStatisticRow,
  NormalizedFixture,
} from "@/lib/football-api/types";

export const LIVE_FIXTURE_STALE_AFTER_MS = 2 * 60 * 1000;

type LiveFixtureSnapshotRow = {
  fixture_id: number;
  league_id: number;
  kickoff_at: string;
  kickoff_date: string;
  status: string;
  bucket: NormalizedFixture["bucket"];
  minute: number | null;
  home_goals: number | null;
  away_goals: number | null;
  score: {
    home: number | null;
    away: number | null;
  };
  stats: {
    split?: FixtureLiveStatsSplit;
    rows?: FixtureStatisticRow[];
  };
  normalized_fixture: NormalizedFixture;
  updated_at: string;
};

function kickoffDateFromIso(iso: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : iso.slice(0, 10);
}

function snapshotPayload(
  fixture: NormalizedFixture,
  updatedAt: string,
): LiveFixtureSnapshotRow {
  return {
    fixture_id: fixture.id,
    league_id: fixture.leagueId,
    kickoff_at: fixture.kickoffIso,
    kickoff_date: kickoffDateFromIso(fixture.kickoffIso),
    status: fixture.statusShort,
    bucket: fixture.bucket,
    minute: fixture.minute,
    home_goals: fixture.homeGoals,
    away_goals: fixture.awayGoals,
    score: {
      home: fixture.homeGoals,
      away: fixture.awayGoals,
    },
    stats: {
      split: fixture.liveStatsSplit,
      rows: fixture.liveStatistics,
    },
    normalized_fixture: {
      ...fixture,
      liveCacheUpdatedAt: updatedAt,
      dataDelayed: false,
    },
    updated_at: updatedAt,
  };
}

function isNormalizedFixture(value: unknown): value is NormalizedFixture {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<NormalizedFixture>;
  return (
    typeof maybe.id === "number" &&
    typeof maybe.leagueId === "number" &&
    typeof maybe.kickoffIso === "string" &&
    typeof maybe.statusShort === "string" &&
    typeof maybe.bucket === "string"
  );
}

export async function upsertLiveFixtureSnapshots(
  sb: SupabaseClient,
  fixtures: readonly NormalizedFixture[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!fixtures.length) return { ok: true, count: 0 };

  const updatedAt = new Date().toISOString();
  const rows = fixtures.map((fixture) => snapshotPayload(fixture, updatedAt));
  const { error } = await sb
    .from("live_fixture_snapshots")
    .upsert(rows, { onConflict: "fixture_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}

export async function fetchLiveFixtureSnapshotsByIds(
  sb: SupabaseClient,
  ids: readonly number[],
  nowMs = Date.now(),
): Promise<{ ok: true; fixtures: NormalizedFixture[] } | { ok: false; error: string }> {
  const cleanIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!cleanIds.length) return { ok: true, fixtures: [] };

  const { data, error } = await sb
    .from("live_fixture_snapshots")
    .select("fixture_id, normalized_fixture, updated_at")
    .in("fixture_id", cleanIds);

  if (error) return { ok: false, error: error.message };

  const fixtures = (data ?? []).flatMap((row) => {
    const fixture = row.normalized_fixture;
    if (!isNormalizedFixture(fixture)) return [];

    const updatedAt =
      typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString();
    const updatedMs = Date.parse(updatedAt);
    const dataDelayed =
      !Number.isFinite(updatedMs) || nowMs - updatedMs > LIVE_FIXTURE_STALE_AFTER_MS;

    return [
      {
        ...fixture,
        liveCacheUpdatedAt: updatedAt,
        dataDelayed,
      },
    ];
  });

  return { ok: true, fixtures };
}
