"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IstoricCalendar } from "@/components/istoric/istoric-calendar";
import { PredictionCard } from "@/components/predictii/prediction-card";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { toSyntheticFinishedFixture } from "@/lib/predictions/historic-row-to-fixture";
import type { PredictionReportRow } from "@/lib/predictions/prediction-repository";
import type { HistoricEngineMetricsSummary } from "@/lib/predictions/historic-metrics";
import { defaultSelectableDateRoInMonth } from "@/lib/football-api/bucharest-calendar";
import { Card } from "@/components/ds/card";

type EngineMetrics = HistoricEngineMetricsSummary;

type HistoricTier = "full" | "public_resolved_only";

export type IstoricViewProps = {
  todayRo: string;
};

function formatSelectedDayLong(dateRo: string): string {
  const [yy, mm, dd] = dateRo.split("-").map(Number);
  if (!yy || !mm || !dd) return dateRo;
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(yy, mm - 1, dd));
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/45 bg-muted/15 px-3 py-3 sm:px-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function IstoricView({ todayRo }: IstoricViewProps) {
  const [selectedDateRo, setSelectedDateRo] = useState(todayRo);
  const [rows, setRows] = useState<PredictionReportRow[]>([]);
  const [fixturesById, setFixturesById] = useState<
    Record<string, NormalizedFixture>
  >({});
  const [loadingDay, setLoadingDay] = useState(false);
  const [metrics, setMetrics] = useState<EngineMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [datesWithData, setDatesWithData] = useState<Set<string>>(() => new Set());
  const [tier, setTier] = useState<HistoricTier | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSelectedDateRo(todayRo));
  }, [todayRo]);

  const bumpMonthSelection = useCallback(
    (year: number, month: number) => {
      setSelectedDateRo(defaultSelectableDateRoInMonth(year, month, todayRo));
    },
    [todayRo],
  );

  function pickTier(raw: unknown): HistoricTier | null {
    return raw === "public_resolved_only" || raw === "full"
      ? (raw as HistoricTier)
      : null;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMetrics(true);
      try {
        const res = await fetch("/api/historic/metrics", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          metrics?: EngineMetrics;
          tier?: string;
        };
        if (!cancelled && j.metrics) {
          setMetrics(j.metrics);
          const t = pickTier(j.tier);
          if (t) setTier(t);
        }
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/historic/dates", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { dates?: string[]; tier?: string };
        if (!cancelled && Array.isArray(j.dates))
          setDatesWithData(new Set(j.dates));
        if (!cancelled) {
          const t = pickTier(j.tier);
          if (t) setTier(t);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDay(true);
      try {
        const res = await fetch(
          `/api/historic/by-date?date=${encodeURIComponent(selectedDateRo)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            setFixturesById({});
          }
          return;
        }
        const j = (await res.json()) as {
          rows?: PredictionReportRow[];
          tier?: string;
          fixtures_by_id?: Record<string, NormalizedFixture>;
        };
        if (!cancelled) {
          setRows(j.rows ?? []);
          setFixturesById(j.fixtures_by_id ?? {});
          const t = pickTier(j.tier);
          if (t) setTier(t);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setFixturesById({});
        }
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDateRo]);

  const selectedLabel = useMemo(
    () => formatSelectedDayLong(selectedDateRo),
    [selectedDateRo],
  );

  const metricsDisplay = loadingMetrics ? null : metrics;
  const isPublicTier = tier === "public_resolved_only";

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricTile
          label="Total analize"
          value={metricsDisplay ? String(metricsDisplay.total) : "-"}
        />
        <MetricTile
          label="Acuratețe motor"
          value={
            metricsDisplay?.accuracyPct != null
              ? `${metricsDisplay.accuracyPct}%`
              : "-"
          }
        />
      </div>

      <section className="w-full min-w-0">
        <IstoricCalendar
          todayRo={todayRo}
          selectedDateRo={selectedDateRo}
          onSelectDateRo={setSelectedDateRo}
          datesWithData={datesWithData}
          onVisibleMonthChange={bumpMonthSelection}
        />
      </section>

      <section className="flex w-full min-w-0 flex-col gap-6">
        <div>
          <h2 className="pb-text-card-title capitalize text-lg text-foreground">
            {selectedLabel}
          </h2>
          <p className="mt-0.5 text-[11px] text-foreground-muted">
            Predicții Probix pentru {selectedDateRo}
            {isPublicTier ? " (predicțiile în curs nu sunt incluse)" : null}
          </p>
        </div>

        <div className="min-h-[4rem]">
          {loadingDay ? (
            <p className="pb-text-body text-sm text-foreground-muted">Se încarcă…</p>
          ) : rows.length === 0 ? (
            <Card staticSurface className="border-dashed p-6 text-center">
              <p className="pb-text-body">
                {isPublicTier
                  ? "Nu există combinații deja rezolvate în date pentru această zi (sau istoric încă nepopulat)."
                  : "Nu există predicții înregistrate pentru această dată."}
              </p>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-2 [grid-auto-rows:minmax(0,_auto)] md:grid-cols-2 md:gap-2.5 [&>*]:min-w-0">
              {rows.map((row) => {
                const fixture =
                  fixturesById[String(row.fixture_id)] ??
                  toSyntheticFinishedFixture(row);
                return (
                  <li key={`${row.fixture_id}-${row.date_ro}`} className="min-w-0">
                    <PredictionCard
                      fixture={fixture}
                      unlocked={tier === "full"}
                      prediction={row.payload}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
