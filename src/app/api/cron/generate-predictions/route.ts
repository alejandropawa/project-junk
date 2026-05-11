import { revalidatePath } from "next/cache";
import { fetchEventOdds, fetchOddsEventsWindow } from "@/lib/predictions/odds-api";
import { decimalsPerMarketAcrossBookmakers } from "@/lib/predictions/odds-probix-map";
import { engineOutputToPredictionPayload } from "@/lib/predictions/map-engine-output";
import { matchOddsEventToFixture } from "@/lib/predictions/match-event";
import {
  fetchPredictionsForDate,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { runProbixEngine } from "@/lib/probix-engine/run-engine";
import { loadProbixLearningContext } from "@/lib/probix-evolution/learning-context";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Vercel / Next: permite cron suficient pentru multe fixture-uri + motor (plan Pro: până la 300). */
export const maxDuration = 300;

const TEN_MIN_MS = 10 * 60 * 1000;

const ENGINE_ATTEMPTS = 4;
const UPSERT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron (~5 minute) — generare de la **T−10 minute** până la salvare: include meciuri **live**
 * dacă predicția lipsește (reîncercări la fiecare ciclu + reîncercări scurte în aceeași cerere).
 * Odds API e opțional (cote de referință dacă `ODDS_API_KEY` e setat).
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

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const oddsKey = process.env.ODDS_API_KEY?.trim();
  const bookmakers =
    process.env.ODDS_API_BOOKMAKERS?.trim() ?? "Bet365,Unibet";

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
          "Supabase service role lipsă (SUPABASE_SERVICE_ROLE_KEY) pentru cron.",
      },
      { status: 500 },
    );
  }

  const data = await fetchTodayTrackedFixturesFresh();
  if (!data.ok) {
    return Response.json({
      ok: false,
      message: data.error ?? "API Football indisponibil",
      processed: 0,
    });
  }

  const now = Date.now();
  const notices: string[] = [];
  let processed = 0;

  const existingByFixtureId = await fetchPredictionsForDate(sb, data.date);

  const candidates = data.fixtures.filter((f) => {
    if (f.bucket !== "upcoming" && f.bucket !== "live") return false;
    const kickMs = f.timestamp * 1000;
    if (now < kickMs - TEN_MIN_MS) return false;
    if (
      imminentWithinMinutes != null &&
      f.bucket === "upcoming" &&
      !(kickMs >= now && kickMs <= now + imminentWithinMinutes * 60_000)
    )
      return false;
    if (!overwritePredictions && existingByFixtureId.has(f.id)) return false;
    return true;
  });

  /** Cron timeout: întâi toate lipsurile LIVE, apoi Urmează după ora start. */
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
    const kickMs = f.timestamp * 1000;

    let oddsApiEventId = 0;
    let oddsBody: Awaited<ReturnType<typeof fetchEventOdds>> | null = null;
    const oddsByMarketId = new Map<string, number>();

    if (oddsKey) {
      const fromIso = new Date(kickMs - 2 * 3600 * 1000).toISOString();
      const toIso = new Date(kickMs + 2 * 3600 * 1000).toISOString();
      try {
        const events = await fetchOddsEventsWindow(oddsKey, fromIso, toIso);
        const matched = matchOddsEventToFixture(
          events,
          f.homeName,
          f.awayName,
          f.timestamp,
        );
        oddsApiEventId = matched?.id ?? 0;
        if (matched) {
          oddsBody = await fetchEventOdds(oddsKey, matched.id, bookmakers);
          if (oddsBody) {
            for (const [k, v] of decimalsPerMarketAcrossBookmakers(
              oddsBody,
              bookmakers,
            )) {
              oddsByMarketId.set(k, v);
            }
          }
        }
      } catch {
        notices.push(`odds reference skip ${f.id}`);
      }
    }

    let engineOut: Awaited<ReturnType<typeof runProbixEngine>> | null = null;
    for (let attempt = 0; attempt < ENGINE_ATTEMPTS; attempt++) {
      engineOut = await runProbixEngine(f, {
        oddsByMarketId,
        learning: learningCtx,
      });
      if (engineOut) break;
      if (attempt < ENGINE_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
    }
    if (!engineOut) {
      notices.push(
        `motor: fără predicție după ${ENGINE_ATTEMPTS} încercări (${f.id})`,
      );
      continue;
    }

    const payload = engineOutputToPredictionPayload(engineOut, {
      oddsApiEventId,
      fixtureId: f.id,
      leagueId: f.leagueId,
      leagueName: f.leagueName,
    });

    let saved = false;
    let lastUpsertError = "";
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
        saved = true;
        existingByFixtureId.set(f.id, payload);
        break;
      }
      lastUpsertError = up.error;
      if (attempt < UPSERT_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
    }
    if (!saved) {
      notices.push(
        `Supabase upsert (${f.id}) după ${UPSERT_ATTEMPTS} încercări: ${lastUpsertError || "necunoscut"}`,
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
      candidateCount: candidates.length,
      /** Lipsă predicție + live (procesate primele). */
      liveMissingCount: candidates.filter((c) => c.bucket === "live")
        .length,
      evolutionLearning: learningSummary,
      selectionMode: process.env.PROBIX_SELECTION_MODE?.trim() || "balanced",
      overwritePredictions,
      imminentWithinMinutes,
    },
    engine: "probix-deterministic-stats",
    at: new Date().toISOString(),
  });
}
