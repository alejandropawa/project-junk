"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type IstoricCalendarProps = {
  todayRo: string;
  selectedDateRo: string;
  onSelectDateRo: (dateRo: string) => void;
  /** date_ro pentru zile cu cel puțin o predicție salvată */
  datesWithData: ReadonlySet<string>;
  /** Apelat când luna vizibilă se schimbă ( săgeți ) - permite alinierea zilei selectate la istoric */
  onVisibleMonthChange?: (year: number, month: number) => void;
};

function parseDateParts(dateRo: string) {
  const [y, m, d] = dateRo.split("-").map(Number);
  return {
    year: y,
    month: m,
    day: d,
    valid: Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d),
  };
}

function ymKey(year: number, month: number) {
  return year * 100 + month;
}

function addMonths(year: number, month: number, delta: number) {
  const dt = new Date(year, month - 1 + delta, 1);
  return { year: dt.getFullYear(), month: dt.getMonth() + 1 };
}

type Cell = { kind: "blank" } | { kind: "day"; dateRo: string; day: number };

function buildMonthGrid(year: number, month: number): Cell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ kind: "blank" });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateRo = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ kind: "day", dateRo, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "blank" });
  return cells;
}

const WEEKDAYS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"] as const;

export function IstoricCalendar({
  todayRo,
  selectedDateRo,
  onSelectDateRo,
  datesWithData,
  onVisibleMonthChange,
}: IstoricCalendarProps) {
  const today = parseDateParts(todayRo);
  const fallbackYm = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const sel0 = parseDateParts(selectedDateRo);
  const initialYm =
    sel0.valid && sel0.year && sel0.month
      ? { year: sel0.year, month: sel0.month }
      : today.valid && today.year && today.month
        ? { year: today.year, month: today.month }
        : fallbackYm;

  const [viewYear, setViewYear] = useState(initialYm.year);
  const [viewMonth, setViewMonth] = useState(initialYm.month);

  useEffect(() => {
    const s = parseDateParts(selectedDateRo);
    if (!s.valid || !s.year || !s.month) return;
    queueMicrotask(() => {
      setViewYear(s.year);
      setViewMonth(s.month);
    });
  }, [selectedDateRo]);

  const todayYm =
    today.valid && today.year && today.month
      ? ymKey(today.year, today.month)
      : ymKey(fallbackYm.year, fallbackYm.month);

  const currentYm = ymKey(viewYear, viewMonth);
  const canGoNext = currentYm < todayYm;

  function goPrevMonth() {
    const n = addMonths(viewYear, viewMonth, -1);
    setViewYear(n.year);
    setViewMonth(n.month);
    onVisibleMonthChange?.(n.year, n.month);
  }

  function goNextMonth() {
    if (!canGoNext) return;
    const n = addMonths(viewYear, viewMonth, 1);
    if (ymKey(n.year, n.month) <= todayYm) {
      setViewYear(n.year);
      setViewMonth(n.month);
      onVisibleMonthChange?.(n.year, n.month);
    }
  }

  const monthTitle = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth - 1, 12));

  const grid = buildMonthGrid(viewYear, viewMonth);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-border/50 bg-muted/[0.12] p-2.5 sm:p-3 md:p-3.5 lg:p-5">
      <div className="flex items-center justify-between gap-2 md:gap-2.5">
        <button
          type="button"
          onClick={goPrevMonth}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/40 text-foreground-secondary transition hover:bg-muted/50 hover:text-foreground pb-focus-ring sm:size-9 md:size-10 lg:size-10"
          aria-label="Luna anterioară"
        >
          <ChevronLeft className="size-4 sm:size-[1.125rem] md:size-5" />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold capitalize tracking-tight text-foreground sm:text-base lg:text-lg">
          {monthTitle}
        </p>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={goNextMonth}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/40 text-foreground-secondary transition pb-focus-ring sm:size-9 md:size-10 lg:size-10",
            canGoNext
              ? "hover:bg-muted/50 hover:text-foreground"
              : "cursor-not-allowed opacity-40",
          )}
          aria-label="Luna următoare"
        >
          <ChevronRight className="size-4 sm:size-[1.125rem] md:size-5" />
        </button>
      </div>

      <div className="mt-3.5 grid w-full grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground-muted sm:mt-5 sm:gap-1 sm:text-[11px] md:gap-1.5 md:text-xs lg:mt-6 lg:text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 sm:py-1.5 lg:py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1.5 grid w-full grid-cols-7 gap-1 sm:mt-2 sm:gap-1.5 md:gap-2 lg:gap-2">
        {grid.map((cell, i) => {
          const cellH =
            "min-h-8 sm:min-h-9 md:min-h-10 lg:min-h-[2.65rem] xl:min-h-12";

          if (cell.kind === "blank") {
            return (
              <div key={`b-${i}`} className={cn(cellH, "w-full rounded-lg")} aria-hidden />
            );
          }
          const { dateRo, day } = cell;
          const isFuture = dateRo > todayRo;
          const isToday = dateRo === todayRo;
          const isSelected = dateRo === selectedDateRo;
          const hasData = datesWithData.has(dateRo);

          return (
            <button
              key={dateRo}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDateRo(dateRo)}
              className={cn(
                cellH,
                "relative flex w-full flex-col items-center justify-center rounded-lg pb-focus-ring text-sm font-semibold tabular-nums transition sm:text-base md:text-lg lg:text-xl xl:text-[1rem]",
                isFuture
                  ? "cursor-not-allowed text-foreground-muted/35"
                  : "text-foreground-secondary hover:bg-muted/45 hover:text-foreground",
                isSelected && "bg-primary/20 text-primary ring-1 ring-primary/40 sm:ring-2",
                isToday &&
                  !isSelected &&
                  "ring-1 ring-amber-400/55 ring-offset-1 ring-offset-background sm:ring-2 sm:ring-offset-2",
              )}
            >
              <span>{day}</span>
              {hasData ? (
                <span
                  className="absolute bottom-1 size-1 rounded-full bg-primary/85 sm:bottom-1.5 sm:size-1.5 md:bottom-2"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
