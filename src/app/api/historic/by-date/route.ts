import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import { fetchPredictionReportRowsForDate } from "@/lib/predictions/prediction-repository";
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
  const filtered = user ? rows : rows.filter((r) => isPredictionCombinationResolved(r.payload));
  const tier = user ? "full" : "public_resolved_only";

  return Response.json({
    ok: true,
    date_ro: dateRo,
    rows: filtered,
    tier,
  });
}
