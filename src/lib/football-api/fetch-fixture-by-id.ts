/**
 * Încarcă un singur meci din API-Football (`/fixtures?id=`) — fără filtru pe zi.
 * Folosit la regenerare analize pentru rânduri existente în `prediction_reports`.
 */
import {
  formatFootballApiErrors,
  hasRealFootballApiErrors,
} from "@/lib/football-api/response-errors";
import { normalizeFixtureRow } from "@/lib/football-api/normalize-fixture-row";
import {
  parseApiResponse,
  type ApiFixtureRow,
  type NormalizedFixture,
} from "@/lib/football-api/types";

const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

export type FetchFixtureByIdResult =
  | { ok: true; fixture: NormalizedFixture }
  | { ok: false; error: string };

export async function fetchFixtureByIdFresh(
  fixtureId: number,
): Promise<FetchFixtureByIdResult> {
  const key = process.env.FOOTBALL_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "Lipsește FOOTBALL_API_KEY." };
  }
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return { ok: false, error: "fixture_id invalid." };
  }

  const url = new URL("/fixtures", API_BASE);
  url.searchParams.set("id", String(Math.trunc(fixtureId)));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Eroare rețea",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `API Football: ${res.status} ${res.statusText}`,
    };
  }

  const json: unknown = await res.json();
  const parsed = parseApiResponse(json);

  if (hasRealFootballApiErrors(parsed.errors)) {
    return {
      ok: false,
      error: formatFootballApiErrors(parsed.errors) || "Răspuns API invalid",
    };
  }

  const rows = parsed.response ?? [];
  const row = rows[0] as ApiFixtureRow | undefined;
  if (!row) {
    return { ok: false, error: `Nu există meci cu id ${fixtureId}.` };
  }

  return { ok: true, fixture: normalizeFixtureRow(row) };
}
