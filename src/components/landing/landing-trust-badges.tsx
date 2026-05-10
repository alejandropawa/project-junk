import { Activity, BarChart3, History } from "lucide-react";

const ITEMS = [
  { icon: Activity, label: "Actualizare live" },
  { icon: BarChart3, label: "Predicții pre-meci" },
  { icon: History, label: "Istoric verificabil" },
] as const;

export function LandingTrustBadges() {
  return (
    <ul className="mt-10 flex flex-wrap gap-2.5 sm:gap-3" aria-label="Angajamente Probix">
      {ITEMS.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background-secondary/50 px-3.5 py-2 text-[12.5px] font-medium text-foreground-secondary backdrop-blur-sm transition-colors hover:border-border hover:text-foreground sm:text-[13px]"
        >
          <Icon className="size-3.5 shrink-0 text-primary/85" strokeWidth={1.75} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
