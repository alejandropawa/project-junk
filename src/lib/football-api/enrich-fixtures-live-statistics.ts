import {
  deriveLiveStatsSplitFromEvents,
  fetchFixtureEventsPayload,
  mergeLiveStatsSplits,
} from "@/lib/football-api/fixture-events-live-stats";
import { fetchFixtureLiveStatsSplit } from "@/lib/football-api/fixture-statistics-fetch";
import type { NormalizedFixture } from "@/lib/football-api/types";

const DEFAULT_CONCURRENCY = 6;

function needsEnrichmentPoll(f: NormalizedFixture): boolean {
  return (
    (f.bucket === "live" || f.bucket === "finished") &&
    f.id > 0 &&
    /** Live reinclus: statistics sunt adesea goale; evenimentele din feed completează. */
    (f.liveStatsSplit == null || f.bucket === "live")
  );
}

/**
 * Completează `liveStatsSplit` pentru live/final: `/fixtures/statistics` + (la nevoie)
 * `/fixtures/events` — aceeași logică ca merge-ul din `/api/fixtures/live`.
 */
export async function enrichFixturesWithLiveStatistics(
  fixtures: NormalizedFixture[],
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<NormalizedFixture[]> {
  const key = process.env.FOOTBALL_API_KEY?.trim();
  if (!key) return fixtures;

  const headers = { "x-apisports-key": key };
  const out = fixtures.map((f) => ({ ...f }));

  const indices = out
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => needsEnrichmentPoll(f))
    .map(({ i }) => i);

  for (let b = 0; b < indices.length; b += concurrency) {
    const chunk = indices.slice(b, b + concurrency);
    await Promise.all(
      chunk.map(async (i) => {
        const f = out[i];

        const splitFromApi = await fetchFixtureLiveStatsSplit(
          f.id,
          f.homeTeamId,
          f.awayTeamId,
          headers,
        );

        /** Mereu `/fixtures/events`: la FT unele ligi au cornere doar în evenimente; la live deja necesar. */
        const evPayload = await fetchFixtureEventsPayload(f.id, headers);

        const splitFromEv = deriveLiveStatsSplitFromEvents(
          evPayload,
          f.homeTeamId,
          f.awayTeamId,
        );

        const merged = mergeLiveStatsSplits(splitFromApi, splitFromEv);

        if (merged) out[i] = { ...out[i], liveStatsSplit: merged };
      }),
    );
  }

  return out;
}
