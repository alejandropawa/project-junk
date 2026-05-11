import {
  formatFootballApiErrors,
  hasRealFootballApiErrors,
} from "@/lib/football-api/response-errors";
import { normalizeFixtureRow } from "@/lib/football-api/normalize-fixture-row";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { getBucharestDateString } from "@/lib/football-api/bucharest-calendar";
import {
  parseApiResponse,
  type TodayFixturesResult,
} from "@/lib/football-api/types";

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";
const TIMEZONE = "Europe/Bucharest";

export { getBucharestDateString };

/** Aliniat la cron-ul Vercel (3 ore); `revalidatePath('/meciuri')` invalidează imediat. */
const REVALIDATE_SECONDS = 10_800;

/** Pentru cron / predicții: meciuri reale fără cache React. */
export async function fetchTodayTrackedFixturesFresh(): Promise<TodayFixturesResult> {
  const date = getBucharestDateString();
  const key = process.env.FOOTBALL_API_KEY;

  if (!key?.trim()) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error:
        "Lipsește FOOTBALL_API_KEY în .env.local. Obține o cheie de la api-sports.io și nu o publica în cod.",
      fixtures: [],
    };
  }

  const url = new URL("/fixtures", API_BASE);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "x-apisports-key": key.trim() },
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: e instanceof Error ? e.message : "Eroare rețea",
      fixtures: [],
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: `API Football: ${res.status} ${res.statusText}`,
      fixtures: [],
    };
  }

  const json: unknown = await res.json();
  const parsed = parseApiResponse(json);

  if (hasRealFootballApiErrors(parsed.errors)) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: formatFootballApiErrors(parsed.errors) || "Răspuns API invalid",
      fixtures: [],
    };
  }

  const rows = parsed.response ?? [];
  const tracked = rows
    .filter((row) => TRACKED_LEAGUE_IDS.has(row.league.id))
    .map(normalizeFixtureRow)
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    ok: true,
    date,
    timezone: TIMEZONE,
    fixtures: tracked,
  };
}

export async function fetchTodayTrackedFixtures(): Promise<TodayFixturesResult> {
  const date = getBucharestDateString();
  const key = process.env.FOOTBALL_API_KEY;

  if (!key?.trim()) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error:
        "Lipsește FOOTBALL_API_KEY în .env.local. Obține o cheie de la api-sports.io și nu o publica în cod.",
      fixtures: [],
    };
  }

  const url = new URL("/fixtures", API_BASE);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "x-apisports-key": key.trim() },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (e) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: e instanceof Error ? e.message : "Eroare rețea",
      fixtures: [],
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: `API Football: ${res.status} ${res.statusText}`,
      fixtures: [],
    };
  }

  const json: unknown = await res.json();
  const parsed = parseApiResponse(json);

  if (hasRealFootballApiErrors(parsed.errors)) {
    return {
      ok: false,
      date,
      timezone: TIMEZONE,
      error: formatFootballApiErrors(parsed.errors) || "Răspuns API invalid",
      fixtures: [],
    };
  }

  const rows = parsed.response ?? [];
  const tracked = rows
    .filter((row) => TRACKED_LEAGUE_IDS.has(row.league.id))
    .map(normalizeFixtureRow)
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    ok: true,
    date,
    timezone: TIMEZONE,
    fixtures: tracked,
  };
}

/**
 * Pagini Meciuri / Predicții: în **development** folosește mereu date proaspete de la API
 * (`cache: no-store`), ca lista de meciuri să nu rămână blocată în Data Cache-ul Next
 * (altfel `fixture_id`-urile pot să nu coincidă cu rândurile din Supabase până la revalidare).
 */
export async function fetchTodayTrackedFixturesForUi(): Promise<TodayFixturesResult> {
  if (process.env.NODE_ENV === "development") {
    return fetchTodayTrackedFixturesFresh();
  }
  return fetchTodayTrackedFixtures();
}
