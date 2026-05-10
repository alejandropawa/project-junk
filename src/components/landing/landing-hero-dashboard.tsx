"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";

type PickTwoAnimated = {
  mode: "animated";
  label: string;
  value: string;
  motionKey: string;
};

type PickTwoProgress = {
  mode: "progress";
  label: string;
  current: number;
  target: number;
};

type DetailMock = {
  league: string;
  home: string;
  away: string;
  score: string;
  pitch: string;
  conf: string;
  stats: readonly { k: string; v: string }[];
  pickOne: { label: string; fulfilled: boolean };
  pickTwo: PickTwoAnimated | PickTwoProgress;
};

function HeroDetailCard({
  data,
  reduce,
}: {
  data: DetailMock;
  reduce: boolean | null;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/40 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
            Flux analitic
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-foreground-muted">
          LIVE
        </span>
      </div>

      <div className="space-y-4 px-4 py-5 md:px-5 md:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
              {data.league}
            </p>
            <p className="mt-1.5 text-pretty text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
              <span className="break-words">{data.home}</span>{" "}
              <span className="inline tabular-nums font-medium text-foreground-secondary">{data.score}</span>{" "}
              <span className="break-words">{data.away}</span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-foreground-muted">{data.pitch}</p>
          </div>
          <div className="shrink-0 self-start rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2 text-left sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              Încredere
            </p>
            <p className="text-lg font-semibold tabular-nums text-primary">{data.conf}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/45 bg-muted/20 p-3">
          {data.stats.map((s) => (
            <div key={s.k} className="min-w-0 text-center">
              <p className="break-words text-[10px] font-medium uppercase leading-tight tracking-wide text-foreground-muted">
                {s.k}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/50 bg-background-secondary/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-foreground-secondary">
              Progres combinație
            </p>
            <TrendingUp className="size-4 shrink-0 text-primary/80" aria-hidden />
          </div>
          <ul className="mt-3 space-y-2.5">
            <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[13px]">
              <span className="min-w-0 text-foreground-secondary">{data.pickOne.label}</span>
              {data.pickOne.fulfilled ? (
                <span className="flex shrink-0 items-center gap-1.5 font-medium text-success">
                  <span className="text-base leading-none">✓</span> îndeplinit
                </span>
              ) : (
                <span className="shrink-0 font-medium text-foreground-muted">în curs</span>
              )}
            </li>
            <li className="text-[13px]">
              {data.pickTwo.mode === "animated" ? (
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-foreground-secondary">{data.pickTwo.label}</span>
                  <span className="shrink-0 font-mono tabular-nums text-foreground">
                    <motion.span
                      key={data.pickTwo.motionKey}
                      initial={reduce ? false : { opacity: 0.6 }}
                      animate={reduce ? undefined : { opacity: [0.65, 1, 0.65] }}
                      transition={{ duration: 2.8, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
                    >
                      {data.pickTwo.value}
                    </motion.span>
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 text-foreground-secondary">{data.pickTwo.label}</span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {data.pickTwo.current} / {data.pickTwo.target}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/80 to-probix-purple/70"
                      style={{
                        width: `${Math.min(100, (data.pickTwo.current / Math.max(1, data.pickTwo.target)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

/** Eternul derby - 0-0; metrici ca în cardurile live (perechi întregi / posesie). */
const SUPERLIGA_MOCK: DetailMock = {
  league: "Superliga",
  home: "FCSB",
  away: "Dinamo București",
  score: "0 - 0",
  pitch: "42′ · joc prudent la mijloc, dueluri fizice fără deschidere clară",
  conf: "81%",
  stats: [
    { k: "Șuturi pe poartă", v: "2 · 1" },
    { k: "Cornere", v: "2 · 3" },
    { k: "Posesie", v: "49% · 51%" },
  ],
  pickOne: { label: "Sub 3,5 goluri", fulfilled: true },
  pickTwo: {
    mode: "animated",
    label: "Cornere combinate (țintă 9)",
    value: "5 / 9",
    motionKey: "corners-ro",
  },
};

/** El Clásico - 1-1; alte rânduri decât derby-ul RO. */
const LALIGA_MOCK: DetailMock = {
  league: "La Liga",
  home: "Real Madrid",
  away: "Barcelona",
  score: "1 - 1",
  pitch: "67′ · tranziții rapide după egalare, ambele caută a treia",
  conf: "77%",
  stats: [
    { k: "Atacuri periculoase", v: "6 · 8" },
    { k: "Șuturi (total)", v: "10 · 9" },
    { k: "Cornere", v: "5 · 3" },
  ],
  pickOne: { label: "GG", fulfilled: true },
  pickTwo: { mode: "progress", label: "Peste 10.5 cornere", current: 8, target: 11 },
};

/** Stivă offset: Superliga în spate, La Liga în față; ~30% din cardul din spate rămâne vizibil sus. */
export function LandingHeroDashboard() {
  const reduce = useReducedMotion();

  const cardShell =
    "overflow-hidden rounded-[22px] border border-border/55 bg-elevated/75 shadow-[var(--shadow-pb-card)] backdrop-blur-md";

  return (
    <div className="relative mx-auto w-full max-w-[28rem] lg:max-w-none">
      <div
        className="pointer-events-none absolute -inset-4 rounded-[28px] bg-gradient-to-br from-primary/[0.12] via-transparent to-probix-purple/[0.08] blur-2xl"
        aria-hidden
      />

      <div className="relative flex flex-col items-stretch overflow-visible px-1 pb-8 pt-1 sm:px-0 sm:pb-10 sm:pt-2">
        <motion.div
          className={`relative z-0 ml-auto w-[min(100%,28rem)] max-w-[28rem] translate-x-0 sm:translate-x-[min(12%,3.5rem)] md:translate-x-[min(22%,5.25rem)] lg:translate-x-[min(26%,6rem)] ${cardShell}`}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroDetailCard data={SUPERLIGA_MOCK} reduce={reduce} />
        </motion.div>

        <div className="relative z-10 -mt-[15rem] ml-auto w-[min(100%,28rem)] max-w-[28rem] translate-x-0 sm:translate-x-[2%] sm:-mt-[15.75rem] md:-mt-[16.25rem]">
          <div className={cardShell}>
            <HeroDetailCard data={LALIGA_MOCK} reduce={reduce} />
          </div>
        </div>
      </div>
    </div>
  );
}
