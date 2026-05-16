import { revalidatePath } from "next/cache";
import { acquireCronLock, releaseCronLock } from "@/lib/cron/locks";
import {
  getBucharestDateString,
  shiftBucharestDateRo,
} from "@/lib/football-api/bucharest-calendar";
import {
  fetchNormalizedFixturesByIds,
  mergedPayloadWithSettlement,
  recomputeSettlementPayloadFromFixture,
} from "@/lib/predictions/settle-predictions";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import {
  fetchPredictionReportRowsForDate,
  fetchPredictionReportRowsForFixtureId,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron: dupa FT, persista settlement in prediction_reports.payload pentru istoric.
 *
 * Query:
 * - repair=1: reciteste din API si rescrie settlement + pickResults.
 * - fixture_id=1531539: limiteaza la acel meci.
 * - repair_lookback_days=7: ultimele N zile RO pentru repair.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repair =
    searchParams.get("repair") === "1" ||
    searchParams.get("repair") === "true";

  const fixtureIdRaw =
    searchParams.get("fixture_id") ?? searchParams.get("fixtureId") ?? "";
  const fixtureIdParsed = fixtureIdRaw.trim() ? Number(fixtureIdRaw.trim()) : NaN;
  const fixtureIdFilter =
    Number.isFinite(fixtureIdParsed) && fixtureIdParsed > 0
      ? Math.floor(fixtureIdParsed)
      : null;

  const repairLookbackRaw = searchParams.get("repair_lookback_days") ?? "";
  const repairLookbackParsed = repairLookbackRaw.trim()
    ? Number(repairLookbackRaw)
    : NaN;
  const repairLookbackDays =
    repair && fixtureIdFilter == null
      ? Number.isFinite(repairLookbackParsed) && repairLookbackParsed > 0
        ? Math.min(14, Math.floor(repairLookbackParsed))
        : 7
      : null;

  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

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
        message: "SUPABASE_SERVICE_ROLE_KEY lipsa.",
      },
      { status: 500 },
    );
  }

  const lockName = repair ? "settle-predictions:repair" : "settle-predictions";
  const lock = await acquireCronLock(sb, lockName, repair ? 900 : 540);
  if (!lock) {
    return Response.json({
      ok: true,
      skipped: true,
      repair,
      reason: "cron_lock_held",
      at: new Date().toISOString(),
    });
  }

  let processed = 0;
  let skippedUnchanged = 0;
  let checked = 0;
  const notices: string[] = [];

  try {
    const today = getBucharestDateString();

    const datesForReportFetch: string[] =
      repair && repairLookbackDays != null
        ? Array.from({ length: repairLookbackDays }, (_, i) =>
            shiftBucharestDateRo(today, -i),
          )
        : [today, shiftBucharestDateRo(today, -1)];

    const allRows =
      fixtureIdFilter != null
        ? await fetchPredictionReportRowsForFixtureId(sb, fixtureIdFilter)
        : (
            await Promise.all(
              datesForReportFetch.map((d) => fetchPredictionReportRowsForDate(sb, d)),
            )
          ).flat();

    const candidates = repair
      ? allRows.filter((r) => Boolean(r.payload.picks?.length))
      : allRows.filter((r) => !isPredictionCombinationResolved(r.payload));
    checked = candidates.length;

    if (candidates.length === 0) {
      return Response.json({
        ok: true,
        repair,
        fixture_id: fixtureIdFilter,
        processed: 0,
        checked: 0,
        at: new Date().toISOString(),
      });
    }

    const ids = [...new Set(candidates.map((r) => r.fixture_id))];
    const fxById = await fetchNormalizedFixturesByIds(ids);

    for (const row of candidates) {
      const nf = fxById.get(row.fixture_id);
      if (!nf) {
        notices.push(`fixture ${row.fixture_id} indisponibil in API`);
        continue;
      }

      const nextPayload = repair
        ? recomputeSettlementPayloadFromFixture(nf, row.payload)
        : mergedPayloadWithSettlement(nf, row.payload);
      if (!nextPayload) continue;

      if (repair) {
        const prevS = row.payload.settlement ?? "pending";
        const nextS = nextPayload.settlement ?? "pending";
        const prevPr = JSON.stringify(row.payload.calibrationOutcome?.pickResults ?? []);
        const nextPr = JSON.stringify(nextPayload.calibrationOutcome?.pickResults ?? []);
        if (prevS === nextS && prevPr === nextPr) {
          skippedUnchanged += 1;
          continue;
        }
      }

      const up = await upsertPrediction(sb, {
        fixture_id: row.fixture_id,
        date_ro: row.date_ro,
        home_name: row.home_name,
        away_name: row.away_name,
        league_name: row.league_name,
        kickoff_iso: row.kickoff_iso,
        payload: nextPayload,
      });
      if (up.ok) processed += 1;
      else notices.push(`upsert esuat ${row.fixture_id}: ${up.error}`);
    }

    revalidatePath("/istoric");
    revalidatePath("/predictii");

    return Response.json({
      ok: true,
      repair,
      repair_lookback_days: repair ? repairLookbackDays : undefined,
      fixture_id: fixtureIdFilter,
      processed,
      skippedUnchanged: repair ? skippedUnchanged : undefined,
      checked,
      notices,
      stats: {
        createdRows: 0,
        updatedRows: processed,
      },
      at: new Date().toISOString(),
    });
  } finally {
    await releaseCronLock(sb, lock, {
      createdCount: 0,
      updatedCount: processed,
      metadata: {
        repair,
        fixtureId: fixtureIdFilter,
        checked,
        processed,
        skippedUnchanged,
      },
    });
  }
}
