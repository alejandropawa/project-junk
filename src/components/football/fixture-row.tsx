import Image from "next/image";
import { LiveBadge } from "@/components/ds/live-badge";
import { liveFixtureClockLabel } from "@/lib/football-api/live-clock-display";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { cn } from "@/lib/utils";

const TZ = "Europe/Bucharest";

/**
 * Două rânduri cu același șablon flex: mijloc cu lățime fixă, laterale `flex-1 min-w-0`
 * astfel că scorul stă mereu pe aceeași axă orizontală între meciuri (evită deriva din grid `auto`/min-content).
 */
const MATCH_ROW = "flex min-w-0 items-center gap-x-2 sm:gap-x-4";
const SIDE = "flex min-w-0 min-h-0 flex-1"; // flex-1 ⇒ 1 1 0%; laterale egale
const MID_W = "w-[4.25rem] shrink-0 flex-none px-1 sm:w-20"; // minut + scor

/** Pulse CSS (tailwind); nu rulează la `prefers-reduced-motion`. */
const LIVE_STATUS_PULSE = "animate-pulse motion-reduce:animate-none";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function scoreLine(f: NormalizedFixture): { home: string; away: string } {
  const h = f.homeGoals;
  const a = f.awayGoals;
  if (f.bucket === "upcoming") {
    return { home: "-", away: "-" };
  }
  if (h == null || a == null) {
    return { home: "-", away: "-" };
  }
  return { home: String(h), away: String(a) };
}

function TeamLogo({ src }: { src: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 object-contain"
        sizes="28px"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground",
      )}
      aria-hidden
    >
      -
    </span>
  );
}

export function FixtureRow({
  fixture: f,
  className,
}: {
  fixture: NormalizedFixture;
  className?: string;
}) {
  const sc = scoreLine(f);
  const live = f.bucket === "live";
  const finished = f.bucket === "finished";
  const clockLabel = liveFixtureClockLabel(f);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/80 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      {/* Ora - aceeași coloană ca în layout-ul anterior */}
      <div className="shrink-0 sm:w-[4.25rem] sm:flex-shrink-0">
        <time
          className="pb-text-caption tabular-nums text-foreground-secondary"
          dateTime={f.kickoffIso}
        >
          {formatKickoff(f.kickoffIso)}
        </time>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
        {/* Rând status - aceleași trei colonne ca mai jos */}
        <div className={MATCH_ROW}>
          <div aria-hidden className={cn(SIDE, "min-h-7")} />
          <div className={cn(MID_W, "relative flex min-h-7 flex-col items-center justify-center")}>
            {finished ? (
              <span className="block text-center text-xs font-medium tabular-nums text-foreground/85">
                FINAL
              </span>
            ) : clockLabel ? (
              <span
                className={cn(
                  "block text-center text-xs font-medium text-destructive",
                  clockLabel.endsWith("'") || clockLabel.endsWith("′")
                    ? "tabular-nums"
                    : "tracking-tight",
                  LIVE_STATUS_PULSE,
                )}
              >
                {clockLabel}
              </span>
            ) : null}
          </div>
          <div className={cn(SIDE, "flex min-h-7 items-center justify-end")}>
            {live ? <LiveBadge className={LIVE_STATUS_PULSE} /> : null}
          </div>
        </div>

        <div className={MATCH_ROW}>
          <div className={cn(SIDE, "flex min-h-[2rem] items-center justify-end gap-2")}>
            <span className="truncate text-right text-sm font-medium text-foreground">
              {f.homeName}
            </span>
            <TeamLogo src={f.homeLogo} />
          </div>

          <div
            className={cn(
              MID_W,
              "flex min-h-[2rem] items-center justify-center gap-1.5 tabular-nums",
            )}
            aria-label="Scor"
          >
            <span className="min-w-[1.25rem] text-center text-lg font-semibold leading-none text-foreground">
              {sc.home}
            </span>
            <span className="text-foreground-muted">:</span>
            <span className="min-w-[1.25rem] text-center text-lg font-semibold leading-none text-foreground">
              {sc.away}
            </span>
          </div>

          <div className={cn(SIDE, "flex min-h-[2rem] items-center justify-start gap-2")}>
            <TeamLogo src={f.awayLogo} />
            <span className="truncate text-left text-sm font-medium text-foreground">
              {f.awayName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
