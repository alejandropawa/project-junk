import type { NormalizedFixture } from "@/lib/football-api/types";

/** Aliniat la `MAX_IDS` din `/api/fixtures/live`. */
export const LIVE_FIXTURE_POLL_CHUNK = 30;

/** Interval polling bucket + statistici (client). */
export const LIVE_FIXTURE_POLL_INTERVAL_MS = 60_000;

/**
 * După FT, API poate întârzia totaluri finale (cornere etc.) — continuăm poll-ul o fereastră scurtă.
 * Raportat la `fixture.timestamp` (kickoff API).
 */
export const POST_FINISH_POLL_WINDOW_HOURS = 4;

export function finishedFixtureWithinPostPollWindow(
  f: Pick<NormalizedFixture, "bucket" | "timestamp">,
): boolean {
  if (f.bucket !== "finished") return false;
  const hoursSinceKickoff = (Date.now() / 1000 - f.timestamp) / 3600;
  return hoursSinceKickoff >= 0 && hoursSinceKickoff <= POST_FINISH_POLL_WINDOW_HOURS;
}

export async function fetchLiveFixturePatches(
  ids: readonly number[],
): Promise<NormalizedFixture[]> {
  if (ids.length === 0) return [];
  const merged: NormalizedFixture[] = [];
  for (let i = 0; i < ids.length; i += LIVE_FIXTURE_POLL_CHUNK) {
    const slice = ids.slice(i, i + LIVE_FIXTURE_POLL_CHUNK);
    const res = await fetch(`/api/fixtures/live?ids=${slice.join("-")}`, {
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { fixtures?: NormalizedFixture[] };
    if (data.fixtures?.length) merged.push(...data.fixtures);
  }
  return merged;
}
