/**
 * IDs from API-Football (api-sports.io). Display names can override API `league.name`.
 * @see https://www.api-football.com/documentation-v3
 */
export const TRACKED_LEAGUES = [
  { id: 39, displayName: "Premier League" },
  { id: 61, displayName: "Ligue 1" },
  { id: 78, displayName: "Bundesliga" },
  { id: 135, displayName: "Serie A" },
  { id: 140, displayName: "La Liga" },
  { id: 283, displayName: "Superliga" },
  { id: 285, displayName: "Cupa României" },
  { id: 555, displayName: "Supercupa Betano" },
  { id: 2, displayName: "UEFA Champions League" },
  { id: 3, displayName: "UEFA Europa League" },
  { id: 848, displayName: "UEFA Conference League" },
  { id: 5, displayName: "UEFA Nations League" },
  { id: 4, displayName: "Euro" },
  { id: 1, displayName: "Cupa Mondială" },
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
