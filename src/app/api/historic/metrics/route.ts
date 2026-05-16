import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import {
  summarizeHistoricEngineMetrics,
  summarizeValueRoiBreakdowns,
} from "@/lib/predictions/historic-metrics";
import { fetchAllPredictionPayloadsForMetrics } from "@/lib/predictions/prediction-repository";
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

  const payloads = (await fetchAllPredictionPayloadsForMetrics(admin)).filter(
    isPredictionCombinationResolved,
  );
  const metrics = summarizeHistoricEngineMetrics(payloads);
  const valueRoi = summarizeValueRoiBreakdowns(payloads);
  const tier = user ? "full" : "public_resolved_only";
  return Response.json({ ok: true, metrics, valueRoi, tier });
}
