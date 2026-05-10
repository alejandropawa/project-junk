"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PredictionCard } from "@/components/predictii/prediction-card";
import { Card } from "@/components/ds/card";
import type { PredictionPayload } from "@/lib/predictions/types";
import type { PredictionPublicTeaser } from "@/lib/predictions/teaser-utils";
import { mergeFixturePatch } from "@/lib/football-api/merge-fixture-patch";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { isDummyPredictiiFixtureId } from "@/lib/predictii/dummy-preview";
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

export type PredictiiFixturesViewProps = {
  fixtures: NormalizedFixture[];
  /** YYYY-MM-DD (Europe/Bucharest) */
  date: string;
  ok: boolean;
  error?: string | null;
  predictionsUnlocked: boolean;
  predictionsByFixtureId: Record<number, PredictionPayload | undefined>;
  predictionTeasersByFixtureId?: Record<number, PredictionPublicTeaser>;
};

export function PredictiiFixturesView({
  fixtures: initialFixtures,
  date,
  ok,
  error,
  predictionsUnlocked,
  predictionsByFixtureId,
  predictionTeasersByFixtureId,
}: PredictiiFixturesViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [fixtures, setFixtures] = useState(initialFixtures);
  const fixturesRef = useRef(fixtures);

  useLayoutEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  /**
   * Dacă HTML-ul a fost randat fără sesiune (SSR) dar browserul are sesiune Supabase,
   * `predictionsUnlocked` și map-ul de predicții rămân goale până la refresh.
   */
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user && !predictionsUnlocked) {
        router.refresh();
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [predictionsUnlocked, router]);

  useEffect(() => {
    queueMicrotask(() => setFixtures(initialFixtures));
  }, [date, initialFixtures]);

  const hasLive = useMemo(
    () => fixtures.some((f) => f.bucket === "live"),
    [fixtures],
  );

  /** Aliniat la pagina Meciuri: refreshează scor/minut/statistici pentru live */
  useEffect(() => {
    if (!ok || !hasLive) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const liveIds = fixturesRef.current
        .filter((f) => f.bucket === "live")
        .filter((f) => !isDummyPredictiiFixtureId(f.id))
        .map((f) => f.id);
      if (liveIds.length === 0) return;

      try {
        const res = await fetch(`/api/fixtures/live?ids=${liveIds.join("-")}`, {
          cache: "no-store",
        });
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

  const filtered = useMemo(
    () => filterForTab(fixtures, tab),
    [fixtures, tab],
  );

  const grouped = useMemo(() => groupByLeague(filtered), [filtered]);

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

  if (!ok && error) {
    return (
      <Card className="p-3">
        <p className="pb-text-card-title text-lg">Predicții indisponibile</p>
        <p className="mt-2 pb-text-body">{error}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="pb-text-section">Predicții</h1>
        <p className="pb-text-body capitalize">{dateLong}</p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-border pb-1"
        role="tablist"
        aria-label="Filtru predicții"
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
        <Card className="p-4 text-center">
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
              aria-labelledby={`pred-league-${group.items[0]?.leagueId}`}
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
                  id={`pred-league-${group.items[0]?.leagueId}`}
                  className="pb-text-card-title text-lg"
                >
                  {group.leagueName}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-2 [grid-auto-rows:minmax(0,_auto)] md:grid-cols-2 md:gap-2.5 [&>*]:min-w-0">
                {group.items.map((fx) => (
                  <PredictionCard
                    key={fx.id}
                    fixture={fx}
                    unlocked={predictionsUnlocked}
                    prediction={predictionsByFixtureId[fx.id]}
                    teaser={
                      !predictionsUnlocked
                        ? predictionTeasersByFixtureId?.[fx.id]
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
