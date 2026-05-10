export type FixtureBucket = "live" | "upcoming" | "finished" | "other";

export type FixtureTeamLiveNumbers = {
  shotsOnGoal?: number | null;
  shotsTotal?: number | null;
  corners?: number | null;
  fouls?: number | null;
  dangerousAttacks?: number | null;
  attacksNormal?: number | null;
  possessionPct?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
};

export type FixtureLiveStatsSplit = {
  home: FixtureTeamLiveNumbers;
  away: FixtureTeamLiveNumbers;
};

export type NormalizedFixture = {
  id: number;
  leagueId: number;
  /** Sezon competitiv în convenția API (ex. 2024 pentru 2024–25); folosit la /teams/statistics. */
  season: number;
  leagueName: string;
  leagueLogo: string | null;
  kickoffIso: string;
  timestamp: number;
  statusShort: string;
  statusLong: string;
  minute: number | null;
  homeTeamId: number;
  awayTeamId: number;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  bucket: FixtureBucket;
  /** Statistici `/fixtures/statistics` (polling live sau final). */
  liveStatsSplit?: FixtureLiveStatsSplit;
};

export type TodayFixturesResult =
  | {
      ok: true;
      date: string;
      timezone: string;
      fixtures: NormalizedFixture[];
    }
  | {
      ok: false;
      date: string;
      timezone: string;
      error: string;
      fixtures: [];
    };

type ApiFixtureResponse = {
  errors?: Record<string, string> | string[];
  response?: ApiFixtureRow[];
};

type ApiFixtureRow = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      short: string;
      long: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    logo: string;
    season?: number;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

export function parseApiResponse(json: unknown): ApiFixtureResponse {
  if (json && typeof json === "object" && "response" in json) {
    return json as ApiFixtureResponse;
  }
  return {};
}

export type { ApiFixtureRow };
