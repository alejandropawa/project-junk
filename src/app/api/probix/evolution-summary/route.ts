import {
  buildProbixEvolutionSummary,
  loadProbixLearningContext,
} from "@/lib/probix-evolution/learning-context";
import { fetchPredictionReportsForLearning } from "@/lib/predictions/prediction-repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Rezumat calibrare + piețe + ligi (date agregate, fără PII în plus față de predicții).
 * Protejat cu același `CRON_SECRET` ca celelalte crons.
 */
export async function GET(req: Request) {
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
        message: "SUPABASE_SERVICE_ROLE_KEY lipsă.",
      },
      { status: 500 },
    );
  }

  const rows = await fetchPredictionReportsForLearning(sb);
  const summary = buildProbixEvolutionSummary(rows);
  const liveCtx = await loadProbixLearningContext(sb).catch(() => null);

  return Response.json({
    ok: true,
    at: new Date().toISOString(),
    selectionModeEnv: process.env.PROBIX_SELECTION_MODE?.trim() || "balanced",
    learnEnabled: process.env.PROBIX_LEARN_ENABLED?.trim() === "true",
    summary,
    activeLearning:
      liveCtx && liveCtx.summary.pickObservations >= 24
        ? {
            picks: liveCtx.summary.pickObservations,
            globalHitRate: liveCtx.summary.globalHitRate,
            scaledMarkets: liveCtx.marketPScale.size,
            leagueFactors: liveCtx.leagueProbFactor.size,
            hardBlockedLeagues: [...liveCtx.hardBlockedLeagueNames],
            calibrationActive: liveCtx.calibration.activeGlobal,
            calibrationSamples: liveCtx.calibration.usedSamples,
            familyReliabilityKeys: liveCtx.familyReliability.size,
          }
        : null,
  });
}
