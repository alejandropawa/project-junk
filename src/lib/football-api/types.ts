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

export type FixtureStatisticRow = {
  typeId: number;
  label: string;
  home: number | null;
  away: number | null;
};

export type NormalizedFixture = {
  id: number;
  leagueId: number;
  season: number;
  leagueName: string;
  leagueLogo: string | null;
  kickoffIso: string;
  timestamp: number;
  statusShort: string;
  statusLong: string;
  minute: number | null;
  addedTime: number | null;
  homeTeamId: number;
  awayTeamId: number;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  bucket: FixtureBucket;
  liveStatsSplit?: FixtureLiveStatsSplit;
  liveStatistics?: FixtureStatisticRow[];
  sportmonksPredictions?: SportmonksPrediction[];
  sportmonksOdds?: SportmonksOdd[];
  liveCacheUpdatedAt?: string;
  dataDelayed?: boolean;
};

export type TrackedLeagueStatus = {
  id: number;
  displayName: string;
  logo: string | null;
  gamesToday: number;
};

export type TodayFixturesResult =
  | {
      ok: true;
      date: string;
      timezone: string;
      fixtures: NormalizedFixture[];
      leagues: TrackedLeagueStatus[];
    }
  | {
      ok: false;
      date: string;
      timezone: string;
      error: string;
      fixtures: [];
      leagues: TrackedLeagueStatus[];
    };

export type SportmonksType = {
  id: number;
  name: string;
  code?: string | null;
  developer_name?: string | null;
  model_type?: string | null;
};

export type SportmonksPrediction = {
  id: number;
  fixture_id: number;
  type_id: number;
  predictions: Record<string, unknown>;
  type?: SportmonksType;
};

export type SportmonksOdd = {
  id: number;
  fixture_id: number;
  market_id: number;
  bookmaker_id: number;
  label: string | null;
  value: string | number | null;
  name: string | null;
  market_description: string | null;
  probability: string | null;
  dp3: string | number | null;
  total: string | null;
  handicap: string | null;
  stopped?: boolean;
};

export type SportmonksParticipant = {
  id: number;
  name: string;
  image_path?: string | null;
  meta?: {
    location?: "home" | "away" | string;
    winner?: boolean | null;
    position?: number | null;
  } | null;
};

export type SportmonksFixtureRow = {
  id: number;
  league_id: number;
  season_id: number;
  round_id?: number | null;
  starting_at: string;
  starting_at_timestamp: number;
  name?: string | null;
  has_odds?: boolean;
  league?: {
    id: number;
    name: string;
    image_path?: string | null;
  } | null;
  participants?: SportmonksParticipant[];
  scores?: Array<{
    description?: string | null;
    score?: {
      goals?: number | null;
      participant?: "home" | "away" | string | null;
    } | null;
  }>;
  state?: {
    state?: string | null;
    name?: string | null;
    short_name?: string | null;
    developer_name?: string | null;
  } | null;
  periods?: Array<{
    started?: number | null;
    time_added?: number | null;
    minutes?: number | null;
  }>;
  statistics?: Array<{
    participant_id?: number | null;
    type_id?: number | null;
    data?: { value?: unknown } | null;
    type?: SportmonksType | null;
  }>;
  events?: readonly unknown[];
  predictions?: SportmonksPrediction[];
  odds?: SportmonksOdd[];
};
