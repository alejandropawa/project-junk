import { cn } from "@/lib/utils";

const statusMap = {
  draft: { label: "Schiță", dot: "bg-foreground-muted" },
  published: { label: "Publicat", dot: "bg-primary" },
  locked: { label: "Blocat", dot: "bg-warning" },
} as const;

export type PredictionStatusVariant = keyof typeof statusMap;

export function PredictionStatus({
  variant,
  className,
}: {
  variant: PredictionStatusVariant;
  className?: string;
}) {
  const s = statusMap[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background-secondary/80 px-3 py-1 text-xs font-medium text-foreground-secondary",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
