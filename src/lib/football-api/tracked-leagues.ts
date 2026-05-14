/**
 * IDs available in the current SportMonks Football plan.
 * @see https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/leagues
 */
export const TRACKED_LEAGUES = [
  { id: 8, displayName: "Premier League" },
  { id: 72, displayName: "Eredivisie" },
  { id: 82, displayName: "Bundesliga" },
  { id: 301, displayName: "Ligue 1" },
  { id: 384, displayName: "Serie A" },
  { id: 474, displayName: "Superliga" },
  { id: 564, displayName: "La Liga" },
] as const;

export const TRACKED_LEAGUE_IDS = new Set<number>(
  TRACKED_LEAGUES.map((l) => l.id),
);

const DISPLAY_BY_ID = Object.fromEntries(
  TRACKED_LEAGUES.map((l) => [l.id, l.displayName]),
) as Record<number, string>;

export function displayLeagueName(leagueId: number, apiName: string) {
  return DISPLAY_BY_ID[leagueId] ?? apiName;
}

export function trackedLeagueDisplayName(leagueId: number): string {
  return DISPLAY_BY_ID[leagueId] ?? `Liga ${leagueId}`;
}
