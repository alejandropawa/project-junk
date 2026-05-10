import { PredictiiFixturesView } from "@/components/predictii/predictii-fixtures-view";
import type { PredictionPayload } from "@/lib/predictions/types";
import { fetchPredictionsForDate } from "@/lib/predictions/prediction-repository";
import {
  teaserFromPayload,
  type PredictionPublicTeaser,
} from "@/lib/predictions/teaser-utils";
import { enrichFixturesWithLiveStatistics } from "@/lib/football-api/enrich-fixtures-live-statistics";
import {
  fetchTodayTrackedFixtures,
  getBucharestDateString,
} from "@/lib/football-api/fetch-today";
import {
  buildDummyPredictiiPreview,
  shouldShowDummyPredictiiCard,
} from "@/lib/predictii/dummy-preview";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PredictiiPage() {
  const supabase = await createClient();
  /** Aliniat cu `proxy.ts`: JWT valid înainte de `getUser` (sesiune proaspăt refresh-uită). */
  const { data: claimsData } = await supabase.auth.getClaims();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUser = Boolean(claimsData?.claims?.sub ?? user?.id);

  const data = await fetchTodayTrackedFixtures();

  const predictionsByFixtureId: Record<number, PredictionPayload | undefined> =
    {};

  const predictionTeasersByFixtureId: Record<
    number,
    PredictionPublicTeaser
  > = {};

  /**
   * Utilizatori autentificați: încarcă predicțiile pentru meciurile afișate.
   *
   * Folosim preferențial `service_role` pe server după ce am verificat sesiunea — evită
   * goluri când JWT-ul din cookie ajunge întârziat în RSC chiar dacă utilizatorul e logat,
   * caz în care `.from(prediction_reports)` cu client anon returna 0 rânduri fără eroare.
   */
  if (sessionUser && data.ok) {
    const admin = createServiceRoleClient();
    const map =
      admin != null
        ? await fetchPredictionsForDate(admin, data.date)
        : await fetchPredictionsForDate(supabase, data.date);
    for (const f of data.fixtures) {
      const p = map.get(f.id);
      if (p != null) {
        predictionsByFixtureId[f.id] = p;
      }
    }
  }

  if (!sessionUser && data.ok) {
    const admin = createServiceRoleClient();
    if (admin) {
      const map = await fetchPredictionsForDate(admin, data.date);
      const fxById = new Map(data.fixtures.map((f) => [f.id, f] as const));
      for (const [id, payload] of map.entries()) {
        predictionTeasersByFixtureId[id] = teaserFromPayload(payload);
        if (fxById.get(id)?.bucket === "finished") {
          predictionsByFixtureId[id] = payload;
        }
      }
    }
  }

  let fixturesForView = data.ok ? [...data.fixtures] : [];
  if (data.ok) {
    fixturesForView = await enrichFixturesWithLiveStatistics(fixturesForView);
  }
  if (sessionUser && data.ok && shouldShowDummyPredictiiCard()) {
    const { fixture, prediction } = buildDummyPredictiiPreview(data.date);
    fixturesForView = [fixture, ...fixturesForView];
    predictionsByFixtureId[fixture.id] = prediction;
  }

  return (
    <main className="relative mx-auto w-full pb-shell-inner flex-1 px-6 py-12 md:px-10 md:py-16">
      <PredictiiFixturesView
        fixtures={fixturesForView}
        date={data.ok ? data.date : getBucharestDateString()}
        ok={data.ok}
        error={data.ok ? null : data.error}
        predictionsUnlocked={sessionUser}
        predictionsByFixtureId={predictionsByFixtureId}
        predictionTeasersByFixtureId={
          sessionUser ? undefined : predictionTeasersByFixtureId
        }
      />
    </main>
  );
}
