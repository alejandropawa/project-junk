import { revalidatePath } from "next/cache";
import {
  getBucharestDateString,
  shiftBucharestDateRo,
} from "@/lib/football-api/bucharest-calendar";
import {
  fetchNormalizedFixturesByIds,
  mergedPayloadWithSettlement,
} from "@/lib/predictions/settle-predictions";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import {
  fetchPredictionReportRowsForDate,
  upsertPrediction,
} from "@/lib/predictions/prediction-repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron: după FT, persistă `settlement` în `prediction_reports.payload` pentru ca istoricul
 * public să poată lista combinații rezolvate (`won` / `lost` / `void`).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const key = process.env.FOOTBALL_API_KEY?.trim();

  if (!secret?.trim()) {
    return Response.json(
      { ok: false, message: "CRON_SECRET nu este configurat." },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret.trim()}`) {
    return Response.json({ ok: false, message: "Neautorizat" }, { status: 401 });
  }
  if (!key) {
    return Response.json(
      { ok: false, message: "FOOTBALL_API_KEY lipsă." },
      { status: 503 },
    );
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

  const today = getBucharestDateString();

  const dates = [today, shiftBucharestDateRo(today, -1)];

  const pending = (
    await Promise.all(dates.map((d) => fetchPredictionReportRowsForDate(sb, d)))
  )
    .flat()
    .filter((r) => !isPredictionCombinationResolved(r.payload));

  if (pending.length === 0) {
    return Response.json({
      ok: true,
      processed: 0,
      checked: 0,
      at: new Date().toISOString(),
    });
  }

  const ids = [...new Set(pending.map((r) => r.fixture_id))];
  const fxById = await fetchNormalizedFixturesByIds(ids, key);

  let processed = 0;
  const notices: string[] = [];

  for (const row of pending) {
    const nf = fxById.get(row.fixture_id);
    if (!nf) {
      notices.push(`fixture ${row.fixture_id} indisponibil în API`);
      continue;
    }

    const nextPayload = mergedPayloadWithSettlement(nf, row.payload);
    if (!nextPayload) continue;

    const ok = await upsertPrediction(sb, {
      fixture_id: row.fixture_id,
      date_ro: row.date_ro,
      home_name: row.home_name,
      away_name: row.away_name,
      league_name: row.league_name,
      kickoff_iso: row.kickoff_iso,
      payload: nextPayload,
    });
    if (ok) processed += 1;
    else notices.push(`upsert eșuat ${row.fixture_id}`);
  }

  revalidatePath("/istoric");
  revalidatePath("/predictii");

  return Response.json({
    ok: true,
    processed,
    checked: pending.length,
    notices,
    at: new Date().toISOString(),
  });
}
