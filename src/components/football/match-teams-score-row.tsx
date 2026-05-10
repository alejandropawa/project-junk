import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rând tip listă Meciuri: laterale egale, mijloc fix pentru scor (aceleași MID ca fixture-row). */
const ROW = "flex min-w-0 items-center gap-x-2 sm:gap-x-4";
const SIDE = "flex min-w-0 min-h-0 flex-1 basis-0";
const MID = "w-[4.25rem] shrink-0 flex-none px-1 sm:w-20";

const SIDE_LABEL =
  "min-w-0 truncate text-sm font-medium text-foreground";

export function MatchTeamsScoreRow({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  center,
  className,
  midClassName,
  sideTextClassName,
}: {
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  center: ReactNode;
  className?: string;
  /** Lățimi extinse pentru scor mare (card Predicții), fără a schima rândul Meciuri. */
  midClassName?: string;
  /** Ierarhie tipografică echipe în afara paginii Meciuri. */
  sideTextClassName?: string;
}) {
  const label = cn(SIDE_LABEL, sideTextClassName);

  return (
    <div className={cn(ROW, className)}>
      <div
        className={cn(SIDE, "flex min-h-[2rem] items-center justify-end gap-2")}
      >
        <span className={cn(label, "text-right")}>{homeName}</span>
        <TeamLogo src={homeLogo} />
      </div>

      <div
        className={cn(
          MID,
          midClassName,
          "flex min-h-[2rem] items-center justify-center gap-1.5 tabular-nums",
        )}
        aria-label="Scor"
      >
        {center}
      </div>

      <div
        className={cn(SIDE, "flex min-h-[2rem] items-center justify-start gap-2")}
      >
        <TeamLogo src={awayLogo} />
        <span className={cn(label, "text-left")}>{awayName}</span>
      </div>
    </div>
  );
}

function TeamLogo({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        className={cn("size-7 shrink-0 object-contain", className)}
        sizes="28px"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      -
    </span>
  );
}
