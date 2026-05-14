import type { NormalizedFixture } from "@/lib/football-api/types";

type ClockFields = Pick<
  NormalizedFixture,
  "bucket" | "statusShort" | "minute" | "addedTime"
>;

function status(statusShort: string): string {
  return statusShort.trim().toUpperCase();
}

function minuteWithAddedTime(
  minute: number | null,
  cap: number,
  addedTime: number | null,
): string | null {
  if (minute == null) return null;
  if (minute > cap) return `${cap}' +${addedTime ?? minute - cap}`;
  return `${minute}'`;
}

function periodClock(
  prefix: "R1" | "R2" | "PR",
  minute: number | null,
  cap: number,
  addedTime: number | null,
): string {
  const clock = minuteWithAddedTime(minute, cap, addedTime);
  return clock ? `${prefix} ${clock}` : prefix;
}

/**
 * Text pentru minut/status live (Meciuri / Predictii).
 * SportMonks trimite starea stabila in `developer_name`, ex:
 * INPLAY_1ST_HALF, INPLAY_2ND_HALF, INPLAY_ET, INPLAY_PENALTIES.
 */
export function liveFixtureClockLabel(f: ClockFields): string | null {
  if (f.bucket !== "live") return null;
  const s = status(f.statusShort);

  if (s === "HT" || s === "BREAK" || s === "BRK") return "Pauza";
  if (s === "EXTRA_TIME_BREAK" || s === "ETB" || s === "BT") return "Pauza";
  if (s === "PEN_BREAK" || s === "PENB") return "Pauza pen.";
  if (s === "INPLAY_PENALTIES" || s === "PEN" || s === "P") return "Penalty-uri";
  if (s === "INPLAY_1ST_HALF" || s === "1ST" || s === "1H") {
    return periodClock("R1", f.minute, 45, f.addedTime);
  }
  if (s === "INPLAY_2ND_HALF" || s === "2ND" || s === "2H") {
    return periodClock("R2", f.minute, 90, f.addedTime);
  }
  if (s === "INPLAY_ET" || s === "ET") {
    return periodClock("PR", f.minute, 105, f.addedTime);
  }
  if (s === "INPLAY_ET_2ND_HALF" || s === "INPLAY_ET_SECOND_HALF" || s === "2ET") {
    return periodClock("PR", f.minute, 120, f.addedTime);
  }
  if (s === "SUSPENDED" || s === "SUSP") return "Suspendat";
  if (s === "INTERRUPTED" || s === "INT") return "Intrerupt";
  if (f.minute != null) return `${f.minute}'`;
  return null;
}
