import { allowIpRequest, clientIpFromRequest } from "@/lib/rate-limit-ip";
import {
  normalizeSportmonksFixtureRow,
  sportmonksFetch,
  trackedFixtureInclude,
} from "@/lib/football-api/sportmonks";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import type { SportmonksFixtureRow } from "@/lib/football-api/types";

export const dynamic = "force-dynamic";

const LIVE_POLL_MAX_PER_MIN = 48;
const LIVE_POLL_WINDOW_MS = 60_000;
const MAX_IDS = 30;

export async function GET(req: Request) {
  const ip = clientIpFromRequest(req);
  if (!allowIpRequest(ip, LIVE_POLL_MAX_PER_MIN, LIVE_POLL_WINDOW_MS)) {
    return Response.json(
      {
        error:
          "Prea multe cereri live. Asteapta putin sau reincarca pagina. (Limitare anti-abuz)",
      },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam?.trim()) {
    return Response.json({ fixtures: [] }, { status: 200 });
  }

  const ids = idsParam
    .split("-")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return Response.json({ fixtures: [] }, { status: 200 });
  }

  const result = await sportmonksFetch<SportmonksFixtureRow[]>(
    `/fixtures/multi/${ids.join(",")}`,
    {
      include: trackedFixtureInclude(),
      filters: "markets:1,2,14,80,86",
      timezone: "Europe/Bucharest",
    },
    { cache: "no-store" },
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  const fixtures = result.data
    .filter((row) => TRACKED_LEAGUE_IDS.has(row.league_id))
    .map(normalizeSportmonksFixtureRow);

  return Response.json({ fixtures });
}
