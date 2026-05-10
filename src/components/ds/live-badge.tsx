import { Badge } from "@/components/ds/badge";
import { cn } from "@/lib/utils";

/** Tipografie unică pentru status „Live” oriunde apare (aliniată la badge-uri predicții). */
export const LIVE_BADGE_TEXT_CLASS =
  "text-xs font-semibold leading-snug tracking-tight";

export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="danger"
      className={cn(
        LIVE_BADGE_TEXT_CLASS,
        "shrink-0 gap-1.5 pr-2.5 normal-case",
        className,
      )}
      aria-label="Live"
    >
      <span
        className="size-2 shrink-0 rounded-full bg-destructive"
        aria-hidden
      />
      Live
    </Badge>
  );
}
