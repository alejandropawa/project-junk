import { PredictiiFixturesView } from "@/components/predictii/predictii-fixtures-view";
import type { PredictionPayload } from "@/lib/predictions/types";
import { fetchPredictionsForDate } from "@/lib/predictions/prediction-repository";
import {
  teaserFromPayload,
  type PredictionPublicTeaser,
} from "@/lib/predictions/teaser-utils";
import {
  fetchTodayTrackedFixtures,
  getBucharestDateString,
} from "@/lib/football-api/fetch-today";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PredictiiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await fetchTodayTrackedFixtures();

  const predictionsByFixtureId: Record<number, PredictionPayload | undefined> =
    {};

  const predictionTeasersByFixtureId: Record<
    number,
    PredictionPublicTeaser
  > = {};

  /**
   * Vizitatori: teaser pentru orice predicție disponibilă; payload complet DOAR dacă
   * meciul e final (combinatie + rezultat pot fi prezentate fără monetizarea „pre-final”).
   */
  if (user && data.ok) {
    const map = await fetchPredictionsForDate(supabase, data.date);
    for (const [id, payload] of map) {
      predictionsByFixtureId[id] = payload;
    }
  }

  if (!user && data.ok) {
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

  return (
    <main className="relative mx-auto w-full pb-shell-inner flex-1 px-6 py-12 md:px-10 md:py-16">
      <PredictiiFixturesView
        fixtures={data.fixtures}
        date={data.ok ? data.date : getBucharestDateString()}
        ok={data.ok}
        error={data.ok ? null : data.error}
        predictionsUnlocked={Boolean(user)}
        predictionsByFixtureId={predictionsByFixtureId}
        predictionTeasersByFixtureId={
          user ? undefined : predictionTeasersByFixtureId
        }
      />
    </main>
  );
}
