import { revalidatePath } from "next/cache";
import { acquireCronLock, releaseCronLock } from "@/lib/cron/locks";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import {
  buildPredictionShadowMode,
  engineOutputToPredictionPayload,
  noBetToPredictionPayload,
} from "@/lib/predictions/map-engine-output";
import {
  fetchPredictionsForDate,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { runProbixEngineDecision } from "@/lib/probix-engine/run-engine";
import { loadProbixLearningContext } from "@/lib/probix-evolution/learning-context";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Vercel / Next: permite cron suficient pentru multe fixture-uri + motor (plan Pro: pana la 300). */
export const maxDuration = 300;

const TEN_MIN_MS = 10 * 60 * 1000;

const ENGINE_ATTEMPTS = 4;
const UPSERT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron (~5 minute): generare de la T-10 minute pana la salvare; include meciuri live
 * daca predictia lipseste. SportMonks furnizeaza probabilitati si cote in acelasi fixture.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const overwritePredictions =
    searchParams.get("overwrite") === "1" ||
    searchParams.get("overwrite") === "true";
  const imminentWithinMinRaw = searchParams.get("imminent_within_minutes");
  const imminentWithinMinParsed = imminentWithinMinRaw?.trim()
    ? Number(imminentWithinMinRaw)
    : NaN;
  const imminentWithinMinutes =
    Number.isFinite(imminentWithinMinParsed) &&
    imminentWithinMinParsed > 0 &&
    imminentWithinMinParsed <= 180
      ? imminentWithinMinParsed
      : null;

  const fixtureIdRaw =
    searchParams.get("fixture_id") ?? searchParams.get("fixtureId") ?? "";
  const fixtureFilterId = fixtureIdRaw.trim()
    ? Number(fixtureIdRaw.trim())
    : NaN;
  const hasFixtureFilter = Number.isFinite(fixtureFilterId);

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret?.trim()) {
    return Response.json(
      { ok: false, message: "CRON_SECRET nu este configurat." },
      { status: 500 },
    );
  }

  if (auth !== `Bearer ${secret.trim()}`) {
    return Response.json({ ok: false, message: "Neautorizat" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  if (!sb) {
    return Response.json(
      {
        ok: false,
        message:
          "Supabase service role lipsa (SUPABASE_SERVICE_ROLE_KEY) pentru cron.",
      },
      { status: 500 },
    );
  }

  const lock = await acquireCronLock(sb, "generate-predictions", 300);
  if (!lock) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "cron_lock_held",
      at: new Date().toISOString(),
    });
  }

  const notices: string[] = [];
  let processed = 0;
  let createdRows = 0;
  let updatedRows = 0;
  let candidateCount = 0;
  let liveMissingCount = 0;

  try {
    const data = await fetchTodayTrackedFixturesFresh();
    if (!data.ok) {
      return Response.json({
        ok: false,
        message: data.error ?? "API Football indisponibil",
        processed: 0,
      });
    }

    const now = Date.now();
    const existingByFixtureId = await fetchPredictionsForDate(sb, data.date);

    const candidates = data.fixtures.filter((f) => {
      if (hasFixtureFilter && f.id !== fixtureFilterId) return false;
      if (f.bucket !== "upcoming" && f.bucket !== "live") return false;
      const kickMs = f.timestamp * 1000;
      const strictKickWindow = !hasFixtureFilter;
      if (strictKickWindow && now < kickMs - TEN_MIN_MS) return false;
      if (
        imminentWithinMinutes != null &&
        f.bucket === "upcoming" &&
        !(kickMs >= now && kickMs <= now + imminentWithinMinutes * 60_000)
      )
        return false;
      if (!overwritePredictions && existingByFixtureId.has(f.id)) return false;
      return true;
    });
    candidateCount = candidates.length;
    liveMissingCount = candidates.filter((c) => c.bucket === "live").length;

    if (hasFixtureFilter && candidates.length === 0) {
      const anyFix = data.fixtures.find((f) => f.id === fixtureFilterId);
      if (!anyFix) {
        return Response.json(
          {
            ok: false,
            message: `fixture_id ${fixtureFilterId} nu apare in ziua tracking (${data.date}).`,
            processed: 0,
          },
          { status: 404 },
        );
      }
      return Response.json({
        ok: false,
        message:
          `fixture ${fixtureFilterId}: nu indeplineste filtre (bucket=${anyFix.bucket}; foloseste imminent_within_minutes sau overwrite dupa ora potrivita).`,
        processed: 0,
        hint: anyFix.bucket,
      });
    }

    candidates.sort((a, b) => {
      const la = a.bucket === "live" ? 0 : 1;
      const lb = b.bucket === "live" ? 0 : 1;
      if (la !== lb) return la - lb;
      return a.timestamp - b.timestamp;
    });

    let learningSummary: null | {
      pickObservations: number;
      globalHitRate: number | null;
      hardBlockedLeagues: number;
      calibrationActive: boolean;
    } = null;
    let learningCtx: Awaited<ReturnType<typeof loadProbixLearningContext>> | null =
      null;
    if (process.env.PROBIX_LEARN_ENABLED?.trim() === "true") {
      try {
        learningCtx = await loadProbixLearningContext(sb);
        learningSummary = {
          pickObservations: learningCtx.summary.pickObservations,
          globalHitRate: learningCtx.summary.globalHitRate,
          hardBlockedLeagues: learningCtx.hardBlockedLeagueNames.size,
          calibrationActive: learningCtx.calibration.activeGlobal,
        };
      } catch {
        notices.push("probix_learn: indisponibil (skip)");
      }
    }

    for (const f of candidates) {
      let engineOut: Awaited<ReturnType<typeof runProbixEngineDecision>> | null = null;
      for (let attempt = 0; attempt < ENGINE_ATTEMPTS; attempt++) {
        engineOut = await runProbixEngineDecision(f, {
          learning: learningCtx,
        });
        if (engineOut) break;
        if (attempt < ENGINE_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      if (!engineOut) {
        notices.push(
          `motor: fara predictie dupa ${ENGINE_ATTEMPTS} incercari (${f.id})`,
        );
        continue;
      }

      const shadowOut = await runProbixEngineDecision(f, {
        learning: learningCtx,
        disableRiskGates: true,
      });

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
      if (shadowOut) {
        payload.shadowMode = buildPredictionShadowMode(engineOut, shadowOut);
      }

      let saved = false;
      let lastUpsertError = "";
      const existedBeforeSave = existingByFixtureId.has(f.id);
      for (let attempt = 0; attempt < UPSERT_ATTEMPTS; attempt++) {
        const up = await upsertPrediction(sb, {
          fixture_id: f.id,
          date_ro: data.date,
          home_name: f.homeName,
          away_name: f.awayName,
          league_name: f.leagueName,
          kickoff_iso: f.kickoffIso,
          payload,
        });
        if (up.ok) {
          processed += 1;
          if (existedBeforeSave) updatedRows += 1;
          else createdRows += 1;
          saved = true;
          existingByFixtureId.set(f.id, payload);
          break;
        }
        lastUpsertError = up.error;
        if (attempt < UPSERT_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      if (!saved) {
        notices.push(
          `Supabase upsert (${f.id}) dupa ${UPSERT_ATTEMPTS} incercari: ${lastUpsertError || "necunoscut"}`,
        );
      }
    }

    revalidatePath("/predictii");
    revalidatePath("/meciuri");
    revalidatePath("/istoric");

    return Response.json({
      ok: true,
      date: data.date,
      processed,
      notices,
      stats: {
        candidateCount,
        liveMissingCount,
        createdRows,
        updatedRows,
        evolutionLearning: learningSummary,
        selectionMode: process.env.PROBIX_SELECTION_MODE?.trim() || "balanced",
        overwritePredictions,
        imminentWithinMinutes,
        fixtureFilterId: hasFixtureFilter ? fixtureFilterId : null,
      },
      engine: "probix-deterministic-stats",
      at: new Date().toISOString(),
    });
  } finally {
    await releaseCronLock(sb, lock, {
      createdCount: createdRows,
      updatedCount: updatedRows,
      metadata: {
        processed,
        candidateCount,
        liveMissingCount,
        overwritePredictions,
        fixtureFilterId: hasFixtureFilter ? fixtureFilterId : null,
      },
    });
  }
}
