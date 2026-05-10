import { cn } from "@/lib/utils";

type PremiumOverlayProps = {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Subtle gate for premium tier - analytical, not flashy */
export function PremiumOverlay({
  title,
  description,
  className,
  children,
}: PremiumOverlayProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[24px]", className)}>
      <div
        className="pointer-events-none select-none opacity-[0.38] blur-[1.5px]"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-border/80 bg-background/90 px-6 py-5 shadow-[var(--shadow-pb-card)] backdrop-blur-md">
          <p className="pb-text-label text-probix-purple/90">Premium</p>
          <p className="mt-2 pb-text-card-title text-lg">{title}</p>
          {description ? (
            <p className="mt-1 pb-text-caption">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
