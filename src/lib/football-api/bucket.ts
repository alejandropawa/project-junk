import type { FixtureBucket } from "@/lib/football-api/types";

function norm(statusShort: string): string {
  return statusShort.trim().toUpperCase();
}

const FINISHED = new Set([
  "FT",
  "AET",
  "PEN",
  "FTP",
  "FT_PEN",
  "AWD",
  "AWAR",
  "AWARDED",
  "WO",
  "ENDED",
  "FINISHED",
]);

const UPCOMING = new Set([
  "NS",
  "TBD",
  "TBA",
  "PST",
  "POST",
  "POSTPONED",
  "DELA",
  "DELAYED",
  "PENDING",
  "NOT_STARTED",
  "SCHEDULED",
]);

const LIVE = new Set([
  "1H",
  "1ST",
  "INPLAY_1ST_HALF",
  "HT",
  "2H",
  "2ND",
  "INPLAY_2ND_HALF",
  "ET",
  "INPLAY_ET",
  "2ET",
  "INPLAY_ET_2ND_HALF",
  "INPLAY_ET_SECOND_HALF",
  "ETB",
  "EXTRA_TIME_BREAK",
  "BT",
  "P",
  "PENB",
  "PEN_BREAK",
  "INPLAY_PENALTIES",
  "SUSP",
  "SUSPENDED",
  "INT",
  "INTERRUPTED",
  "LIVE",
  "INPLAY",
  "BREAK",
  "BRK",
]);

/** Meci terminat pe fluier (FT / prelungiri / penalty) - folosit la settlement. */
export function isTerminalFixtureStatus(statusShort: string): boolean {
  return FINISHED.has(norm(statusShort));
}

export function fixtureBucket(statusShort: string): FixtureBucket {
  const s = norm(statusShort);
  if (FINISHED.has(s)) return "finished";
  if (UPCOMING.has(s)) return "upcoming";
  if (LIVE.has(s)) return "live";
  return "other";
}
