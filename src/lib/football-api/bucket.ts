import type { FixtureBucket } from "@/lib/football-api/types";

const FINISHED = new Set(["FT", "AET", "PEN", "AWD"]);

const UPCOMING = new Set(["NS", "TBD", "PST"]);

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT"]);

/** Meci terminat pe fluier (FT / prelungiri / penalty) — folosit la settlement, nu la „live”. */
export function isTerminalFixtureStatus(statusShort: string): boolean {
  return FINISHED.has(statusShort);
}

export function fixtureBucket(statusShort: string): FixtureBucket {
  if (FINISHED.has(statusShort)) return "finished";
  if (UPCOMING.has(statusShort)) return "upcoming";
  if (LIVE.has(statusShort)) return "live";
  return "other";
}
