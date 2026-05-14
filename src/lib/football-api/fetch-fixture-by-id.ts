import {
  normalizeSportmonksFixtureRow,
  sportmonksFetch,
  trackedFixtureInclude,
} from "@/lib/football-api/sportmonks";
import type { NormalizedFixture, SportmonksFixtureRow } from "@/lib/football-api/types";

export async function fetchFixtureByIdFresh(
  fixtureId: number,
): Promise<{ ok: true; fixture: NormalizedFixture } | { ok: false; error: string }> {
  const result = await sportmonksFetch<SportmonksFixtureRow>(
    `/fixtures/${fixtureId}`,
    {
      include: trackedFixtureInclude(),
      filters: "markets:1,2,14,80,86",
      timezone: "Europe/Bucharest",
    },
    { cache: "no-store" },
  );

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, fixture: normalizeSportmonksFixtureRow(result.data) };
}
