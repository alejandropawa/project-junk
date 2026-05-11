import { PredictiiFixturesView } from "@/components/predictii/predictii-fixtures-view";
import type { PredictionPayload } from "@/lib/predictions/types";
import { fetchPredictionsForFixtureIds } from "@/lib/predictions/prediction-repository";
import {
  teaserFromPayload,
  type PredictionPublicTeaser,
} from "@/lib/predictions/teaser-utils";
import { enrichFixturesWithLiveStatistics } from "@/lib/football-api/enrich-fixtures-live-statistics";
import {
  fetchTodayTrackedFixturesForUi,
  getBucharestDateString,
} from "@/lib/football-api/fetch-today";
import {
  buildDummyPredictiiPreview,
  isDummyPredictiiFixtureId,
  shouldShowDummyPredictiiCard,
} from "@/lib/predictii/dummy-preview";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PredictiiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  /** După `getUser`: claims pot lipsi în unele contexte RSC locale; prioritate `user.id`. */
  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionUser = Boolean(user?.id ?? claimsData?.claims?.sub);

  const data = await fetchTodayTrackedFixturesForUi();

  const predictionsByFixtureId: Record<number, PredictionPayload | undefined> =
    {};

  const predictionTeasersByFixtureId: Record<
    number,
    PredictionPublicTeaser
  > = {};

  /**
   * Predicții după `fixture_id` (nu doar `date_ro` = ziua paginii), ca meciurile afișate
   * de API pentru „azi” să găsească rândul salvat chiar dacă `date_ro` din DB e altă zi.
   */
  if (data.ok) {
    const fixtureIds = data.fixtures
      .map((f) => f.id)
      .filter((id) => !isDummyPredictiiFixtureId(id));

    if (sessionUser) {
      const admin = createServiceRoleClient();
      const client = admin ?? supabase;
      const map = await fetchPredictionsForFixtureIds(
        client,
        fixtureIds,
        data.date,
      );
      for (const f of data.fixtures) {
        const p = map.get(f.id);
        if (p != null) predictionsByFixtureId[f.id] = p;
      }
    } else {
      const admin = createServiceRoleClient();
      if (admin) {
        const map = await fetchPredictionsForFixtureIds(
          admin,
          fixtureIds,
          data.date,
        );
        for (const f of data.fixtures) {
          const p = map.get(f.id);
          if (p == null) continue;
          predictionTeasersByFixtureId[f.id] = teaserFromPayload(p);
          if (f.bucket === "finished") {
            predictionsByFixtureId[f.id] = p;
          }
        }
      } else if (process.env.NODE_ENV === "development") {
        console.warn(
          "[probix/predictii] Vizitator fără SUPABASE_SERVICE_ROLE_KEY: tabela prediction_reports nu e citibilă cu cheia anon (RLS). Pune service role în .env.local sau autentifică-te.",
        );
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
