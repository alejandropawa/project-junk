import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFixtureByIdFresh } from "@/lib/football-api/fetch-fixture-by-id";
import { engineOutputToPredictionPayload } from "@/lib/predictions/map-engine-output";
import {
  fetchAllPredictionReportRows,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import type { PredictionPayload } from "@/lib/predictions/types";
import { runProbixEngine } from "@/lib/probix-engine/run-engine";
import { loadProbixLearningContext } from "@/lib/probix-evolution/learning-context";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ENGINE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 900;
const DEFAULT_CONCURRENCY = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Păstrează verdictul deja închis pe combinație; restul vine din motor (inclusiv analiza nouă). */
function mergePayloadPreserveSettlement(
  fresh: PredictionPayload,
  previous: PredictionPayload,
): PredictionPayload {
  return {
    ...fresh,
    settlement: previous.settlement ?? fresh.settlement,
    calibrationOutcome:
      previous.calibrationOutcome ?? fresh.calibrationOutcome,
  };
}

/**
 * Regenerare masivă **analiză + restul payload-ului din motor** pentru toate rândurile
 * din `prediction_reports` (localhost sau prod — depinde de `SUPABASE_*` din env).
 *
 * **Autorizare:** `Authorization: Bearer $CRON_SECRET`
 *
 * Exemple:
 * - `GET /api/cron/regenerate-prediction-analysis?dry_run=1` — numără, nu scrie
 * - `GET /api/cron/regenerate-prediction-analysis?limit=20` — primele 20 după sort
 * - `GET /api/cron/regenerate-prediction-analysis` — tot tabelul (atenție la timeout / plan)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dryRun =
    searchParams.get("dry_run") === "1" ||
    searchParams.get("dry_run") === "true";
  const limitRaw = searchParams.get("limit") ?? "";
  const limitParsed = limitRaw.trim() ? Number(limitRaw) : NaN;
  const limit =
    Number.isFinite(limitParsed) && limitParsed > 0 ? Math.floor(limitParsed) : null;

  const concurrencyRaw = searchParams.get("concurrency") ?? "";
  const concParsed = concurrencyRaw.trim() ? Number(concurrencyRaw) : NaN;
  const concurrency = Math.min(
    6,
    Math.max(
      1,
      Number.isFinite(concParsed) && concParsed > 0
        ? Math.floor(concParsed)
        : DEFAULT_CONCURRENCY,
    ),
  );

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

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return Response.json(
      {
        ok: false,
        message:
          "Supabase service role lipsă (SUPABASE_SERVICE_ROLE_KEY) pentru cron.",
      },
      { status: 500 },
    );
  }

  let learningCtx: Awaited<ReturnType<typeof loadProbixLearningContext>> | null =
    null;
  if (process.env.PROBIX_LEARN_ENABLED?.trim() === "true") {
    try {
      learningCtx = await loadProbixLearningContext(supabase);
    } catch {
      /* skip */
    }
  }

  const rowsAll = await fetchAllPredictionReportRows(supabase);
  const rows = limit != null ? rowsAll.slice(0, limit) : rowsAll;

  const notices: string[] = [];
  let updated = 0;
  let failed = 0;
  const truncatedByLimit =
    limit != null ? Math.max(0, rowsAll.length - rows.length) : 0;

  async function processOne(
    row: (typeof rows)[0],
    db: SupabaseClient,
  ): Promise<"ok" | "fail"> {
    const prev = row.payload;
    const fx = await fetchFixtureByIdFresh(row.fixture_id);
    if (!fx.ok) {
      notices.push(`${row.fixture_id}: fixture ${fx.error}`);
      return "fail";
    }

    let engineOut: Awaited<ReturnType<typeof runProbixEngine>> | null = null;
    for (let a = 0; a < ENGINE_ATTEMPTS; a++) {
      engineOut = await runProbixEngine(fx.fixture, {
        learning: learningCtx,
      });
      if (engineOut) break;
      if (a < ENGINE_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
    }

    if (!engineOut) {
      notices.push(`${row.fixture_id}: motor fără output`);
      return "fail";
    }

    const fresh = engineOutputToPredictionPayload(engineOut, {
      fixtureId: fx.fixture.id,
      leagueId: fx.fixture.leagueId,
      leagueName: fx.fixture.leagueName,
      oddsApiEventId: prev.oddsApiEventId ?? 0,
    });

    const merged = mergePayloadPreserveSettlement(fresh, prev);

    if (dryRun) {
      return "ok";
    }

    const up = await upsertPrediction(db, {
      fixture_id: row.fixture_id,
      date_ro: row.date_ro,
      home_name: row.home_name,
      away_name: row.away_name,
      league_name: row.league_name,
      kickoff_iso: row.kickoff_iso,
      payload: merged,
    });

    if (up.ok) {
      return "ok";
    }
    notices.push(`${row.fixture_id}: upsert ${up.error}`);
    return "fail";
  }

  for (let i = 0; i < rows.length; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((r) => processOne(r, supabase)),
    );
    for (const r of results) {
      if (r === "ok") updated += 1;
      else failed += 1;
    }
  }

  if (!dryRun) {
    revalidatePath("/predictii");
    revalidatePath("/meciuri");
    revalidatePath("/istoric");
  }

  return Response.json({
    ok: true,
    dryRun,
    totalRowsInDb: rowsAll.length,
    processedRows: rows.length,
    truncatedByLimit,
    updated,
    failed,
    notices: notices.slice(0, 80),
    noticeTruncated: notices.length > 80,
    at: new Date().toISOString(),
    hint:
      "Rulează pe **același** proiect unde ai `SUPABASE_SERVICE_ROLE_KEY` + `SPORTMONKS_API_TOKEN` + `CRON_SECRET` (localhost `.env.local` sau Vercel prod). Prod: apelează URL-ul de producție cu secretul din env-ul de producție.",
  });
}
