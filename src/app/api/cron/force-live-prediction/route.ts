import { revalidatePath } from "next/cache";
import { fetchEventOdds, fetchOddsEventsWindow } from "@/lib/predictions/odds-api";
import { decimalsPerMarketAcrossBookmakers } from "@/lib/predictions/odds-probix-map";
import { engineOutputToPredictionPayload } from "@/lib/predictions/map-engine-output";
import { matchOddsEventToFixture } from "@/lib/predictions/match-event";
import {
  predictionExists,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { runProbixEngine } from "@/lib/probix-engine/run-engine";
import { loadProbixLearningContext } from "@/lib/probix-evolution/learning-context";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ ok: false, message: "Neautorizat" }, { status: 401 });
}

function resolveFixtureFilter(req: Request, bodyFixture: unknown): number | null {
  const { searchParams } = new URL(req.url);
  const q =
    searchParams.get("fixture_id") ?? searchParams.get("fixtureId") ?? "";

  if (q.trim()) {
    const n = Number(q.trim());
    return Number.isFinite(n) ? n : null;
  }

  if (bodyFixture != null) {
    const n = Number(bodyFixture);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

async function tryEnrichOdds(
  f: { homeName: string; awayName: string; timestamp: number },
  kickMs: number,
  bookmakers: string,
): Promise<{ oddsApiEventId: number; oddsBody: Awaited<ReturnType<typeof fetchEventOdds>> | null }> {
  const oddsKey = process.env.ODDS_API_KEY?.trim();
  if (!oddsKey) return { oddsApiEventId: 0, oddsBody: null };

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
    const oddsApiEventId = matched?.id ?? 0;
    if (!matched)
      return { oddsApiEventId: 0, oddsBody: null };
    const oddsBody = await fetchEventOdds(oddsKey, matched.id, bookmakers);
    return { oddsApiEventId, oddsBody };
  } catch {
    return { oddsApiEventId: 0, oddsBody: null };
  }
}

/**
 * Ops / dev: pentru meciuri deja „live”, cron-ul obișnuit nu mai intră (`upcoming` only).
 * Rulează motorul Probix și face upsert la fel ca generate-predictions.
 *
 * curl -H "Authorization: Bearer $CRON_SECRET" \\
 *   "http://localhost:3000/api/cron/force-live-prediction?fixture_id=1234567"
 *
 * `?overwrite=1` — face upsert chiar dacă există deja predicție (regen logică nouă).
 *
 * Body JSON opțional (POST): `{ "fixture_id": 1234567 }` sau `fixtureId`.
 * Fără ID: meciuri live din ligi urmărite în app care încă nu au rând în `prediction_reports`.
 */
export async function GET(req: Request) {
  return handle(req, null);
}

export async function POST(req: Request) {
  let bodyFixture: unknown;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    bodyFixture = b.fixture_id ?? b.fixtureId;
  } catch {
    bodyFixture = null;
  }
  return handle(req, bodyFixture);
}

async function handle(
  req: Request,
  bodyFixture: unknown,
): Promise<Response> {
  const overwrite =
    new URL(req.url).searchParams.get("overwrite") === "1" ||
    new URL(req.url).searchParams.get("overwrite") === "true";

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const bookmakers =
    process.env.ODDS_API_BOOKMAKERS?.trim() ?? "Bet365,Unibet";

  if (!secret?.trim()) {
    return Response.json(
      { ok: false, message: "CRON_SECRET nu este configurat." },
      { status: 500 },
    );
  }

  if (auth !== `Bearer ${secret.trim()}`) {
    return unauthorized();
  }

  const sb = createServiceRoleClient();
  if (!sb) {
    return Response.json(
      {
        ok: false,
        message:
          "SUPABASE_SERVICE_ROLE_KEY lipsă — nu putem scrie în prediction_reports.",
      },
      { status: 500 },
    );
  }

  const filterId = resolveFixtureFilter(req, bodyFixture);

  const data = await fetchTodayTrackedFixturesFresh();
  if (!data.ok) {
    return Response.json(
      {
        ok: false,
        message: data.error ?? "API Football indisponibil",
        processed: 0,
      },
      { status: 502 },
    );
  }

  let targets = data.fixtures.filter(
    (f) => f.bucket === "live" && TRACKED_LEAGUE_IDS.has(f.leagueId),
  );

  if (filterId != null) {
    targets = targets.filter((f) => f.id === filterId);
    if (targets.length === 0) {
      const any = data.fixtures.find((f) => f.id === filterId);
      if (!any) {
        return Response.json(
          {
            ok: false,
            message: `Nu există fixture ${filterId} în lista urmărită pentru ${data.date}.`,
          },
          { status: 404 },
        );
      }
      if (any.bucket !== "live") {
        return Response.json(
          {
            ok: false,
            message: `Fixture ${filterId} nu e live (bucket: ${any.bucket}).`,
          },
          { status: 400 },
        );
      }
      if (!TRACKED_LEAGUE_IDS.has(any.leagueId)) {
        return Response.json(
          {
            ok: false,
            message: `Liga ${any.leagueId} nu e în lista de ligi urmărite în app.`,
          },
          { status: 400 },
        );
      }
      targets = [any];
    }
  }

  const notices: string[] = [];
  let processed = 0;

  let learningCtx: Awaited<ReturnType<typeof loadProbixLearningContext>> | null =
    null;
  if (process.env.PROBIX_LEARN_ENABLED?.trim() === "true") {
    try {
      learningCtx = await loadProbixLearningContext(sb);
    } catch {
      notices.push("probix_learn: indisponibil (skip)");
    }
  }

  for (const f of targets) {
    if (!overwrite && (await predictionExists(sb, f.id, data.date))) continue;

    const kickMs = f.timestamp * 1000;

    let oddsApiEventId = 0;
    let oddsBody: Awaited<ReturnType<typeof fetchEventOdds>> | null = null;
    const oddsByMarketId = new Map<string, number>();
    if (process.env.ODDS_API_KEY?.trim()) {
      const r = await tryEnrichOdds(f, kickMs, bookmakers);
      oddsApiEventId = r.oddsApiEventId;
      oddsBody = r.oddsBody;
      if (oddsBody) {
        for (const [k, v] of decimalsPerMarketAcrossBookmakers(
          oddsBody,
          bookmakers,
        )) {
          oddsByMarketId.set(k, v);
        }
      }
    }

    const engineOut = await runProbixEngine(f, {
      oddsByMarketId,
      learning: learningCtx,
    });
    if (!engineOut) {
      notices.push(`motor: date insuficiente sau combo sub prag (${f.id})`);
      continue;
    }

    const payload = engineOutputToPredictionPayload(engineOut, {
      oddsApiEventId,
      fixtureId: f.id,
      leagueId: f.leagueId,
      leagueName: f.leagueName,
    });

    const up = await upsertPrediction(sb, {
      fixture_id: f.id,
      date_ro: data.date,
      home_name: f.homeName,
      away_name: f.awayName,
      league_name: f.leagueName,
      kickoff_iso: f.kickoffIso,
      payload,
    });
    if (up.ok) processed += 1;
    else notices.push(`Supabase upsert ${f.id}: ${up.error}`);
  }

  revalidatePath("/predictii");
  revalidatePath("/meciuri");
  revalidatePath("/istoric");

  return Response.json({
    ok: true,
    date: data.date,
    overwrite,
    targets: targets.map((t) => ({
      id: t.id,
      home: t.homeName,
      away: t.awayName,
      leagueId: t.leagueId,
    })),
    processed,
    notices,
    at: new Date().toISOString(),
  });
}
