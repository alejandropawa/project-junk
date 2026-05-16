import { PredictiiFixturesView } from "@/components/predictii/predictii-fixtures-view";
import type { PredictionPayload } from "@/lib/predictions/types";
import { combinedDecimalFromPicks } from "@/lib/predictions/combined-odds";
import {
  fetchPredictionsForFixtureIds,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import {
  engineOutputToPredictionPayload,
  noBetToPredictionPayload,
} from "@/lib/predictions/map-engine-output";
import { runProbixEngineDecision } from "@/lib/probix-engine/run-engine";
import {
  teaserFromPayload,
  type PredictionPublicTeaser,
} from "@/lib/predictions/teaser-utils";
import {
  fetchTodayTrackedFixturesFresh,
  fetchTodayTrackedFixturesForUi,
  getBucharestDateString,
} from "@/lib/football-api/fetch-today";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TEN_MIN_MS = 10 * 60 * 1000;
const MIN_PUBLISHED_DECIMAL = 2;

function isPublishablePrediction(payload: PredictionPayload): boolean {
  if (payload.predictionOutcome === "NO_BET") return true;
  if (!payload.picks?.length) return false;
  const combined =
    payload.estimatedCombinedDecimal ?? combinedDecimalFromPicks(payload.picks);
  return combined != null && combined >= MIN_PUBLISHED_DECIMAL;
}

export default async function PredictiiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  /** După `getUser`: claims pot lipsi în unele contexte RSC locale; prioritate `user.id`. */
  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionUser = Boolean(user?.id ?? claimsData?.claims?.sub);

  const data = sessionUser
    ? await fetchTodayTrackedFixturesFresh()
    : await fetchTodayTrackedFixturesForUi();

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
    const fixtureIds = data.fixtures.map((f) => f.id);

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
        if (p != null && isPublishablePrediction(p)) {
          predictionsByFixtureId[f.id] = p;
        }
      }

      const now = Date.now();
      const missingGenerationTargets = data.fixtures.filter((f) => {
        if (predictionsByFixtureId[f.id]) return false;
        if (f.bucket === "live") return true;
        if (f.bucket !== "upcoming") return false;
        return now >= f.timestamp * 1000 - TEN_MIN_MS;
      });

      for (const f of missingGenerationTargets) {
        const engineOut = await runProbixEngineDecision(f);
        if (!engineOut) continue;

        const payload =
          "kind" in engineOut
            ? noBetToPredictionPayload(engineOut, {
                fixtureId: f.id,
                leagueId: f.leagueId,
                leagueName: f.leagueName,
              })
            : engineOutputToPredictionPayload(engineOut, {
                oddsApiEventId: 0,
                fixtureId: f.id,
                leagueId: f.leagueId,
                leagueName: f.leagueName,
              });

        predictionsByFixtureId[f.id] = payload;

        if (admin) {
          await upsertPrediction(admin, {
            fixture_id: f.id,
            date_ro: data.date,
            home_name: f.homeName,
            away_name: f.awayName,
            league_name: f.leagueName,
            kickoff_iso: f.kickoffIso,
            payload,
          });
        }
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

  return (
    <main className="relative mx-auto w-full pb-shell-inner flex-1 px-6 py-12 md:px-10 md:py-16">
      <PredictiiFixturesView
        fixtures={data.ok ? data.fixtures : []}
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
