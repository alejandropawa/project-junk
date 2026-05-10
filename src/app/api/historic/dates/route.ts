import {
  fetchDistinctPredictionDateRosResolvedPublic,
  fetchDistinctPredictionDatesRo,
} from "@/lib/predictions/prediction-repository";
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

  const dates = user
    ? await fetchDistinctPredictionDatesRo(admin)
    : await fetchDistinctPredictionDateRosResolvedPublic(admin);

  const tier = user ? "full" : "public_resolved_only";
  return Response.json({ ok: true, dates, tier });
}
