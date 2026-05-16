"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PredictionCard } from "@/components/predictii/prediction-card";
import { Card } from "@/components/ds/card";
import type { PredictionPayload } from "@/lib/predictions/types";
import type { PredictionPublicTeaser } from "@/lib/predictions/teaser-utils";
import {
  fetchLiveFixturePatches,
  LIVE_FIXTURE_POLL_INTERVAL_MS,
  upcomingFixtureWithinKickoffPollWindow,
} from "@/lib/football-api/live-poll-client";
import { mergeFixturePatch } from "@/lib/football-api/merge-fixture-patch";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
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
  const predictionsByFixtureIdRef = useRef(predictionsByFixtureId);

  useLayoutEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  useLayoutEffect(() => {
    predictionsByFixtureIdRef.current = predictionsByFixtureId;
  }, [predictionsByFixtureId]);

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

  /**
   * Poll 60s: meciuri live + meciuri FT încă cu combinație `pending` în payload,
   * ca bucket/scor/statistici să se stabilizeze înainte de verdict UI + cron settle.
   */
  const shouldPollFixturesLiveApi = useMemo(() => {
    const hasLive = fixtures.some((f) => f.bucket === "live");
    const hasFinishedPendingCombo = fixtures.some((f) => {
      if (f.bucket !== "finished") return false;
      const p = predictionsByFixtureId[f.id];
      return Boolean(
        p?.picks?.length && !isPredictionCombinationResolved(p),
      );
    });
    const hasImminentKickoff = fixtures.some(upcomingFixtureWithinKickoffPollWindow);
    return hasLive || hasFinishedPendingCombo || hasImminentKickoff;
  }, [fixtures, predictionsByFixtureId]);

  const shouldRefreshMissingUnlockedPredictions = useMemo(() => {
    if (!predictionsUnlocked) return false;
    return fixtures.some((f) => {
      if (
        f.bucket !== "live" &&
        f.bucket !== "finished" &&
        !upcomingFixtureWithinKickoffPollWindow(f)
      ) {
        return false;
      }
      return !predictionsByFixtureId[f.id]?.picks?.length;
    });
  }, [fixtures, predictionsByFixtureId, predictionsUnlocked]);

  useEffect(() => {
    if (!ok || !shouldPollFixturesLiveApi) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const liveIds = fixturesRef.current
        .filter((f) => f.bucket === "live")
        .map((f) => f.id);
      const imminentKickoffIds = fixturesRef.current
        .filter(upcomingFixtureWithinKickoffPollWindow)
        .map((f) => f.id);
      const finishedPendingIds = fixturesRef.current
        .filter((f) => f.bucket === "finished")
        .filter((f) => {
          const p = predictionsByFixtureIdRef.current[f.id];
          return Boolean(
            p?.picks?.length && !isPredictionCombinationResolved(p),
          );
        })
        .map((f) => f.id);
      const ids = [...new Set([...liveIds, ...imminentKickoffIds, ...finishedPendingIds])];
      if (ids.length === 0) return;

      try {
        const next = await fetchLiveFixturePatches(ids);
        if (!next.length || cancelled) return;
        setFixtures((prev) => mergeFixturePatch(prev, next));
      } catch {
        /* rețea / timeout */
      }
    };

    void tick();
    const id = window.setInterval(tick, LIVE_FIXTURE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ok, shouldPollFixturesLiveApi]);

  useEffect(() => {
    if (!ok || !shouldRefreshMissingUnlockedPredictions) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, LIVE_FIXTURE_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ok, router, shouldRefreshMissingUnlockedPredictions]);

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
              <div className="grid grid-cols-1 gap-2 [grid-auto-rows:minmax(0,_auto)] md:grid-cols-2 md:[grid-auto-rows:1fr] md:gap-2.5 [&>*]:min-w-0 [&>*]:h-full">
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
