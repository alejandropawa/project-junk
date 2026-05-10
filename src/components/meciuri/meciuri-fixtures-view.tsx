"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ds/card";
import { FixtureRow } from "@/components/football/fixture-row";
import { mergeFixturePatch } from "@/lib/football-api/merge-fixture-patch";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { cn } from "@/lib/utils";

type Tab = "all" | "live" | "upcoming" | "finished";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Toate" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Urmează" },
  { id: "finished", label: "Final" },
];

function groupByLeague(items: NormalizedFixture[]) {
  const map = new Map<
    number,
    {
      leagueName: string;
      leagueLogo: string | null;
      items: NormalizedFixture[];
    }
  >();

  for (const f of items) {
    const cur = map.get(f.leagueId);
    if (cur) {
      cur.items.push(f);
    } else {
      map.set(f.leagueId, {
        leagueName: f.leagueName,
        leagueLogo: f.leagueLogo,
        items: [f],
      });
    }
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => a.timestamp - b.timestamp),
    }))
    .sort(
      (a, b) =>
        Math.min(...a.items.map((i) => i.timestamp)) -
        Math.min(...b.items.map((i) => i.timestamp)),
    );
}

function filterForTab(
  fixtures: NormalizedFixture[],
  tab: Tab,
): NormalizedFixture[] {
  if (tab === "all") {
    return fixtures.filter((f) => f.bucket !== "other");
  }
  return fixtures.filter((f) => f.bucket === tab);
}

function countForTab(fixtures: NormalizedFixture[], tab: Tab): number {
  return filterForTab(fixtures, tab).length;
}

export type MeciuriFixturesViewProps = {
  fixtures: NormalizedFixture[];
  /** YYYY-MM-DD (Europe/Bucharest) */
  date: string;
  ok: boolean;
  error?: string | null;
};

export function MeciuriFixturesView({
  fixtures: initialFixtures,
  date,
  ok,
  error,
}: MeciuriFixturesViewProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [fixtures, setFixtures] = useState(initialFixtures);
  const fixturesRef = useRef(fixtures);

  useLayoutEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  /** Reîncarcă din server props (cron / navigare nouă). */
  useEffect(() => {
    queueMicrotask(() => setFixtures(initialFixtures));
  }, [date, initialFixtures]);

  const hasLive = useMemo(
    () => fixtures.some((f) => f.bucket === "live"),
    [fixtures],
  );

  /** Doar dacă sunt meciuri live: poll la ~1 min la API-ul live (fără call când nimic nu e în joc). */
  useEffect(() => {
    if (!ok || !hasLive) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const liveIds = fixturesRef.current
        .filter((f) => f.bucket === "live")
        .map((f) => f.id);
      if (liveIds.length === 0) return;

      try {
        const res = await fetch(
          `/api/fixtures/live?ids=${liveIds.join("-")}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { fixtures?: NormalizedFixture[] };
        const next = data.fixtures;
        if (!next?.length) return;
        setFixtures((prev) => mergeFixturePatch(prev, next));
      } catch {
        /* rețea / timeout */
      }
    };

    void tick();
    const id = window.setInterval(tick, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ok, hasLive]);

  const dateLong = useMemo(() => {
    const [yy, mm, dd] = date.split("-").map(Number);
    if (!yy || !mm || !dd) return date;
    return new Intl.DateTimeFormat("ro-RO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(yy, mm - 1, dd));
  }, [date]);

  const filtered = useMemo(
    () => filterForTab(fixtures, tab),
    [fixtures, tab],
  );

  const grouped = useMemo(() => groupByLeague(filtered), [filtered]);

  if (!ok && error) {
    return (
      <Card className="p-6">
        <p className="pb-text-card-title text-lg">Meciuri indisponibile</p>
        <p className="mt-2 pb-text-body">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="pb-text-section">Meciuri</h1>
        <p className="pb-text-body capitalize">{dateLong}</p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-border pb-1"
        role="tablist"
        aria-label="Filtru meciuri"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = countForTab(fixtures, t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors pb-focus-ring",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-foreground-secondary hover:bg-muted/60 hover:text-foreground",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums text-foreground-muted">
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {grouped.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="pb-text-body">
            Nu există meciuri.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-border/80">
          {grouped.map((group) => (
            <section
              key={group.leagueName + group.items[0]?.leagueId}
              className="min-w-0 pt-10 first:pt-0"
              aria-labelledby={`league-${group.items[0]?.leagueId}`}
            >
              <div className="mb-4 flex items-center gap-3">
                {group.leagueLogo ? (
                  <Image
                    src={group.leagueLogo}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 object-contain"
                  />
                ) : null}
                <h2
                  id={`league-${group.items[0]?.leagueId}`}
                  className="pb-text-card-title text-lg"
                >
                  {group.leagueName}
                </h2>
              </div>
              <Card className="px-4 py-0 sm:px-6">
                {group.items.map((fx) => (
                  <FixtureRow key={fx.id} fixture={fx} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
