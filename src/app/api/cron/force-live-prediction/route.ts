import { revalidatePath } from "next/cache";
import { enrichPayloadWithOddsSnapshot } from "@/lib/predictions/odds-enrich";
import { fetchEventOdds, fetchOddsEventsWindow } from "@/lib/predictions/odds-api";
import { engineOutputToPredictionPayload } from "@/lib/predictions/map-engine-output";
import { matchOddsEventToFixture } from "@/lib/predictions/match-event";
import { upsertPrediction } from "@/lib/predictions/prediction-repository";
import { PROBIX_ENGINE_LEAGUE_IDS } from "@/lib/probix-engine/config";
import { runProbixEngine } from "@/lib/probix-engine/run-engine";
import { fetchTodayTrackedFixturesFresh } from "@/lib/football-api/fetch-today";
import { TRACKED_LEAGUE_IDS } from "@/lib/football-api/tracked-leagues";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Ligă eligibilă pentru forțare live: în dev = orice ligă urmărită; în prod = doar motorul Probix. */
function forceLiveLeagueIds(): Set<number> {
  return process.env.NODE_ENV === "development"
    ? TRACKED_LEAGUE_IDS
    : PROBIX_ENGINE_LEAGUE_IDS;
}

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
 * Body JSON opțional (POST): `{ "fixture_id": 1234567 }` sau `fixtureId`.
 * Fără ID: procesează toate meciurile live urmărite (în dev: orice ligă tracked; în prod: ligă în motor).
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

  const leagueOk = forceLiveLeagueIds();
  let targets = data.fixtures.filter(
    (f) => f.bucket === "live" && leagueOk.has(f.leagueId),
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
      if (!leagueOk.has(any.leagueId)) {
        return Response.json(
          {
            ok: false,
            message:
              process.env.NODE_ENV === "development"
                ? `Liga ${any.leagueId} nu e în lista de ligi urmărite în app.`
                : `Liga ${any.leagueId} nu e în setul motorului Probix (prod).`,
          },
          { status: 400 },
        );
      }
      targets = [any];
    }
  }

  const notices: string[] = [];
  let processed = 0;

  for (const f of targets) {
    const kickMs = f.timestamp * 1000;
    const engineOut = await runProbixEngine(f);
    if (!engineOut) {
      notices.push(`motor: date insuficiente sau combo sub prag (${f.id})`);
      continue;
    }

    let oddsApiEventId = 0;
    let oddsBody: Awaited<ReturnType<typeof fetchEventOdds>> | null = null;
    if (process.env.ODDS_API_KEY?.trim()) {
      const r = await tryEnrichOdds(f, kickMs, bookmakers);
      oddsApiEventId = r.oddsApiEventId;
      oddsBody = r.oddsBody;
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
