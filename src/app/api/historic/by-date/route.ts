import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import { fetchPredictionReportRowsForDate } from "@/lib/predictions/prediction-repository";
import { fetchNormalizedFixturesByIds } from "@/lib/predictions/settle-predictions";
import type { NormalizedFixture } from "@/lib/football-api/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isDateRo(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateRo = searchParams.get("date")?.trim() ?? "";
  if (!isDateRo(dateRo)) {
    return Response.json({ ok: false, message: "Parametru date invalid." }, { status: 400 });
  }

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

  const rows = await fetchPredictionReportRowsForDate(admin, dateRo);
  const filtered = rows.filter((r) => isPredictionCombinationResolved(r.payload));
  const tier = user ? "full" : "public_resolved_only";

  const ids = [...new Set(filtered.map((r) => r.fixture_id))].filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  let fixtures_by_id: Record<string, NormalizedFixture> = {};
  if (ids.length > 0) {
    try {
      const map = await fetchNormalizedFixturesByIds(ids);
      fixtures_by_id = Object.fromEntries(
        [...map.entries()].map(([k, v]) => [String(k), v]),
      );
    } catch {
      fixtures_by_id = {};
    }
  }

  return Response.json({
    ok: true,
    date_ro: dateRo,
    rows: filtered,
    tier,
    fixtures_by_id,
  });
}
