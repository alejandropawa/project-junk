"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type Ref } from "react";
import type { HistoricEngineMetricsSummary } from "@/lib/predictions/historic-metrics";

export type LandingLiveMeta = {
  liveCount: number | null;
  calendarDate: string;
};

function StatCardShell({
  label,
  children,
  rootRef,
}: {
  label: string;
  children: React.ReactNode;
  rootRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={rootRef}
      className="group relative h-full min-w-0 overflow-hidden rounded-2xl border border-border/55 bg-elevated/50 p-6 shadow-[var(--shadow-pb-card)] transition-[border-color,transform] duration-300 hover:border-border hover:-translate-y-0.5 md:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <p className="relative break-words text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </p>
      <p className="relative mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground md:text-[2.1rem]">
        {children}
      </p>
    </div>
  );
}

function StatCardStatic({
  label,
  end,
  format,
}: {
  label: string;
  end: number | null;
  format: (n: number) => string;
}) {
  return (
    <StatCardShell label={label}>
      {end === null ? "—" : format(end)}
    </StatCardShell>
  );
}

function StatCardAnimated({
  label,
  end,
  format,
}: {
  label: string;
  end: number;
  format: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [text, setText] = useState(() => format(0));

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let controls: ReturnType<typeof animate> | undefined;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setText(format(0));
      controls = animate(0, end, {
        duration: 1.35,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => {
          if (!cancelled) setText(format(v));
        },
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      controls?.stop();
    };
  }, [end, format, inView]);

  return (
    <StatCardShell label={label} rootRef={ref}>
      {text}
    </StatCardShell>
  );
}

export function LandingStatCounters({
  metrics,
  liveMeta,
}: {
  metrics: HistoricEngineMetricsSummary | null;
  liveMeta: LandingLiveMeta;
}) {
  const reduce = useReducedMotion();

  const predictionsTotal = metrics != null ? metrics.total : null;
  const accuracyPct = metrics != null ? metrics.accuracyPct : null;
  const liveCount = liveMeta.liveCount;

  const fmtInt = (n: number) => Math.round(n).toLocaleString("ro-RO");
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const cardPredictions =
    reduce || predictionsTotal === null ? (
      <StatCardStatic label="Predicții" end={predictionsTotal} format={fmtInt} />
    ) : (
      <StatCardAnimated label="Predicții" end={predictionsTotal} format={fmtInt} />
    );

  const cardAccuracy =
    reduce || accuracyPct === null ? (
      <StatCardStatic label="Acuratețe combinații" end={accuracyPct} format={fmtPct} />
    ) : (
      <StatCardAnimated label="Acuratețe combinații" end={accuracyPct} format={fmtPct} />
    );

  const cardLive =
    liveCount === null ? (
      <StatCardStatic label="Meciuri în flux live" end={null} format={fmtInt} />
    ) : reduce ? (
      <StatCardStatic label="Meciuri în flux live" end={liveCount} format={fmtInt} />
    ) : (
      <StatCardAnimated label="Meciuri în flux live" end={liveCount} format={fmtInt} />
    );

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4 md:gap-5">
      {cardPredictions}
      {cardAccuracy}
      {cardLive}
    </div>
  );
}
