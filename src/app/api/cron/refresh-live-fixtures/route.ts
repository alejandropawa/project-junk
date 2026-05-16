import { revalidatePath } from "next/cache";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import { upsertLiveFixtureSnapshots } from "@/lib/football-api/live-fixture-cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { NormalizedFixture } from "@/lib/football-api/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRE_KICKOFF_REFRESH_WINDOW_MINUTES = 10;
const POST_KICKOFF_REFRESH_WINDOW_MINUTES = 20;
const POST_FINISH_REFRESH_WINDOW_HOURS = 4;

function isWithinActiveMatchWindow(fixture: NormalizedFixture, nowMs: number): boolean {
  const kickMs = fixture.timestamp * 1000;
  if (fixture.bucket === "live") return true;
  if (fixture.bucket === "upcoming") {
    const minutesFromKickoff = (nowMs - kickMs) / 60_000;
    return (
      minutesFromKickoff >= -PRE_KICKOFF_REFRESH_WINDOW_MINUTES &&
      minutesFromKickoff <= POST_KICKOFF_REFRESH_WINDOW_MINUTES
    );
  }
  if (fixture.bucket === "finished") {
    const hoursSinceKickoff = (nowMs - kickMs) / 3_600_000;
    return hoursSinceKickoff >= 0 && hoursSinceKickoff <= POST_FINISH_REFRESH_WINDOW_HOURS;
  }
  return false;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret?.trim()) {
    return Response.json(
      { ok: false, message: "CRON_SECRET nu este configurat." },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret.trim()}`) {
    return Response.json({ ok: false, message: "Neautorizat" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  if (!sb) {
    return Response.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY lipsa." },
      { status: 500 },
    );
  }

  const data = await fetchTodayTrackedFixturesFresh();
  if (!data.ok) {
    return Response.json({
      ok: false,
      message: data.error ?? "SportMonks indisponibil",
      refreshed: 0,
      at: new Date().toISOString(),
    });
  }

  const nowMs = Date.now();
  const candidates = data.fixtures.filter((fixture) =>
    isWithinActiveMatchWindow(fixture, nowMs),
  );

  const upsert = await upsertLiveFixtureSnapshots(sb, candidates);
  if (!upsert.ok) {
    return Response.json(
      {
        ok: false,
        message: upsert.error,
        candidates: candidates.length,
        at: new Date().toISOString(),
      },
      { status: 502 },
    );
  }

  if (upsert.count > 0) {
    revalidatePath("/meciuri");
    revalidatePath("/predictii");
  }

  return Response.json({
    ok: true,
    date: data.date,
    refreshed: upsert.count,
    activeWindowCount: candidates.length,
    liveCount: candidates.filter((fixture) => fixture.bucket === "live").length,
    at: new Date().toISOString(),
  });
}
