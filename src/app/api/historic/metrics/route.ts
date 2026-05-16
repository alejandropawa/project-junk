import {
  summarizeHistoricEngineMetrics,
  summarizeValueRoiBreakdowns,
} from "@/lib/predictions/historic-metrics";
import { fetchAllPredictionReportRows } from "@/lib/predictions/prediction-repository";
import { fetchNormalizedFixturesByIds } from "@/lib/predictions/settle-predictions";
import {
  isHistoricFixtureFinal,
  isHistoricRowResolved,
  withDerivedHistoricSettlement,
} from "@/lib/predictions/historic-derived-settlement";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const anon = await createClient();
  const {
    data: { user },
  } = await anon.auth.getUser();

  const admin = createServiceRoleClient();
  if (!admin) {
    return Response.json(
      {
        ok: false,
        message: "Persistența istoricului nu este configurată (service role Supabase).",
      },
      { status: 503 },
    );
  }

  const rows = await fetchAllPredictionReportRows(admin);
  const ids = [...new Set(rows.map((r) => r.fixture_id))].filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  let fixtures = new Map();
  if (ids.length > 0) {
    try {
      fixtures = await fetchNormalizedFixturesByIds(ids);
    } catch {
      fixtures = new Map();
    }
  }
  const payloads = rows
    .map((row) => withDerivedHistoricSettlement(row, fixtures.get(row.fixture_id)))
    .filter(
      (row) =>
        isHistoricFixtureFinal(fixtures.get(row.fixture_id)) &&
        isHistoricRowResolved(row),
    )
    .map((row) => row.payload);
  const metrics = summarizeHistoricEngineMetrics(payloads);
  const valueRoi = summarizeValueRoiBreakdowns(payloads);
  const tier = user ? "full" : "public_resolved_only";
  return Response.json({ ok: true, metrics, valueRoi, tier });
}
