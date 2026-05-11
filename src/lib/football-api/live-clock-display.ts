import type { NormalizedFixture } from "@/lib/football-api/types";

/** API-Football: meci „live” dar cronometrul nu avansează — nu afișăm minutul blocat (ex. 45′). */
const HALF_TIME_BREAK = new Set<string>(["HT"]);
/** Pauză înainte/după reprize de prelungiri (break time). */
const EXTRA_TIME_BREAK = new Set<string>(["BT"]);

type ClockFields = Pick<
  NormalizedFixture,
  "bucket" | "statusShort" | "minute"
>;

/**
 * Text pentru colțul de minut la meciuri live (Meciuri / Predicții).
 * - **HT** → Pauză (rep. 1)
 * - **BT** → Prelungiri (pauză prelungiri)
 * - altfel `42′` dacă există minut
 */
export function liveFixtureClockLabel(f: ClockFields): string | null {
  if (f.bucket !== "live") return null;
  if (HALF_TIME_BREAK.has(f.statusShort)) return "Pauză";
  if (EXTRA_TIME_BREAK.has(f.statusShort)) return "Prelungiri";
  if (f.minute != null) return `${f.minute}′`;
  return null;
}
