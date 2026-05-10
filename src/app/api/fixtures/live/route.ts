import { parseFixtureStatisticsBody } from "@/lib/football-api/fixture-live-stats";
import {
  formatFootballApiErrors,
  hasRealFootballApiErrors,
} from "@/lib/football-api/response-errors";
import { normalizeFixtureRow } from "@/lib/football-api/normalize-fixture-row";
import { parseApiResponse } from "@/lib/football-api/types";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { allowIpRequest, clientIpFromRequest } from "@/lib/rate-limit-ip";

export const dynamic = "force-dynamic";

/** Best-effort per instanță; pe Vercel folosește Redis/KV pentru limită globală. */
const LIVE_POLL_MAX_PER_MIN = 48;
const LIVE_POLL_WINDOW_MS = 60_000;

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

const MAX_IDS = 30;

async function fetchStatisticsJson(
  fixtureId: number,
  headers: HeadersInit,
): Promise<unknown | null> {
  const url = new URL("/fixtures/statistics", API_BASE);
  url.searchParams.set("fixture", String(fixtureId));
  try {
    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Polling pentru meciuri live: `fixtures` actualizate + statistic pe `fixtures/statistics`. */
export async function GET(req: Request) {
  const ip = clientIpFromRequest(req);
  if (!allowIpRequest(ip, LIVE_POLL_MAX_PER_MIN, LIVE_POLL_WINDOW_MS)) {
    return Response.json(
      {
        error:
          "Prea multe cereri live. Așteaptă puțin sau reîncarcă pagina. (Limitare anti-abuz)",
      },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const key = process.env.FOOTBALL_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { error: "Football API neconfigurat" },
      { status: 503 },
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

  const url = new URL("/fixtures", API_BASE);
  url.searchParams.set("ids", ids.join("-"));

  const headers = { "x-apisports-key": key };

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Rețea" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return Response.json(
      { error: `HTTP ${res.status}` },
      { status: 502 },
    );
  }

  const json: unknown = await res.json();
  const parsed = parseApiResponse(json);

  if (hasRealFootballApiErrors(parsed.errors)) {
    return Response.json(
      { error: formatFootballApiErrors(parsed.errors) },
      { status: 502 },
    );
  }

  const rows = parsed.response ?? [];
  const fixturesBase = rows
    .filter((row) => TRACKED_LEAGUE_IDS.has(row.league.id))
    .map(normalizeFixtureRow);

  const enriched = await Promise.all(
    fixturesBase.map(async (nf) => {
      const statsJson = await fetchStatisticsJson(nf.id, headers);
      if (!statsJson || typeof statsJson !== "object") return nf;

      const statParsed = parseApiResponse(statsJson);
      if (hasRealFootballApiErrors(statParsed.errors)) return nf;

      const split = parseFixtureStatisticsBody(
        statsJson,
        nf.homeTeamId,
        nf.awayTeamId,
      );

      return split ? { ...nf, liveStatsSplit: split } : nf;
    }),
  );

  return Response.json({ fixtures: enriched });
}
