import { cn } from "@/lib/utils";

type ProbixLogoProps = {
  className?: string;
  /** Show the Probix wordmark next to the mark */
  showWordmark?: boolean;
  /** Larger mark (e.g. footer hero) */
  markClassName?: string;
  /** Override wordmark typography */
  wordmarkClassName?: string;
};

/**
 * Simple mark: rounded tile + S-curve suggesting a probability / forecast signal.
 */
export function ProbixLogo({
  className = "",
  showWordmark = true,
  markClassName,
  wordmarkClassName,
}: ProbixLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        className={cn("h-9 w-9 shrink-0", markClassName)}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          className="stroke-white/90"
          strokeWidth="2"
        />
        <path
          d="M10 28c5-12 15-12 22-6"
          className="stroke-primary"
          strokeWidth="2.25"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="31" cy="14" r="3.5" className="fill-primary" />
      </svg>
      {showWordmark && (
        <span
          className={cn(
            "font-[family-name:var(--font-bebas)] text-2xl tracking-[0.08em] text-foreground md:text-[1.65rem]",
            wordmarkClassName,
          )}
        >
          PROBIX
        </span>
      )}
    </span>
  );
}
