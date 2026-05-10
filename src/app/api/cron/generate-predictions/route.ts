import { revalidatePath } from "next/cache";
import { enrichPayloadWithOddsSnapshot } from "@/lib/predictions/odds-enrich";
import { fetchEventOdds, fetchOddsEventsWindow } from "@/lib/predictions/odds-api";
import { engineOutputToPredictionPayload } from "@/lib/predictions/map-engine-output";
import { matchOddsEventToFixture } from "@/lib/predictions/match-event";
import {
  predictionExists,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { PROBIX_ENGINE_LEAGUE_IDS } from "@/lib/probix-engine/config";
import { runProbixEngine } from "@/lib/probix-engine/run-engine";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEN_MIN_MS = 10 * 60 * 1000;

/**
 * Cron (~5 minute) — generare automată în fereastra **[T−10 minute, T)** (10 minute înainte
 * de start până la fluier). Motor Probix + persistare predicție unică în `prediction_reports`.
 * Odds API e opțional (cote de referință dacă `ODDS_API_KEY` e setat).
 */
export async function GET(req: Request) {
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

  for (const f of data.fixtures) {
    if (f.bucket !== "upcoming") continue;

    const kickMs = f.timestamp * 1000;
    const inTenMinWindow = now >= kickMs - TEN_MIN_MS && now < kickMs;
    if (!inTenMinWindow) continue;

    if (!PROBIX_ENGINE_LEAGUE_IDS.has(f.leagueId)) {
      notices.push(`skip engine league ${f.leagueId}`);
      continue;
    }

    if (await predictionExists(sb, f.id, data.date)) continue;

    const engineOut = await runProbixEngine(f);
    if (!engineOut) {
      notices.push(`motor: date insuficiente sau echipe IDS lipsă (${f.id})`);
      continue;
    }

    let oddsApiEventId = 0;
    let oddsBody: Awaited<ReturnType<typeof fetchEventOdds>> | null = null;

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
        }
      } catch {
        notices.push(`odds reference skip ${f.id}`);
      }
    }

    let payload = engineOutputToPredictionPayload(engineOut, { oddsApiEventId });
    if (oddsBody) {
      payload = enrichPayloadWithOddsSnapshot(payload, oddsBody, bookmakers);
    }

    const okRow = await upsertPrediction(sb, {
      fixture_id: f.id,
      date_ro: data.date,
      home_name: f.homeName,
      away_name: f.awayName,
      league_name: f.leagueName,
      kickoff_iso: f.kickoffIso,
      payload,
    });
    if (okRow) processed += 1;
    else notices.push(`Supabase upsert eșuat ${f.id}`);
  }

  revalidatePath("/predictii");
  revalidatePath("/meciuri");
  revalidatePath("/istoric");

  return Response.json({
    ok: true,
    date: data.date,
    processed,
    notices,
    engine: "probix-deterministic-stats",
    at: new Date().toISOString(),
  });
}
