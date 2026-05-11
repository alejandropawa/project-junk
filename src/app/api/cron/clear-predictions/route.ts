import { revalidatePath } from "next/cache";
import { deleteAllPredictionReports } from "@/lib/predictions/prediction-repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Operațiune de mentenanță: șterge **tot** din `prediction_reports`.
 * Pază obligatorie: `Authorization: Bearer $CRON_SECRET`.
 *
 * După deploy Probix nou: poți apela asta apoi `/api/cron/generate-predictions` pentru a recrea predicții în fereastra T−10m.
 *
 * ```
 * curl -H "Authorization: Bearer $CRON_SECRET" "https://<domeniu>/api/cron/clear-predictions"
 * ```
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
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

  const confirm = new URL(req.url).searchParams.get("confirm") === "1";

  /** Evită DELETE accidental din crawler (necesită confirm explicit în URL). */
  if (!confirm) {
    return Response.json(
      {
        ok: false,
        message:
          "Confirmă golirea cu ?confirm=1 (șterge tot istoricul predictii din prediction_reports).",
      },
      { status: 400 },
    );
  }

  const res = await deleteAllPredictionReports(sb);
  if (!res.ok) {
    return Response.json(
      { ok: false, message: `delete eșuat: ${res.error}` },
      { status: 500 },
    );
  }

  revalidatePath("/predictii");
  revalidatePath("/meciuri");
  revalidatePath("/istoric");

  return Response.json({
    ok: true,
    cleared: true,
    at: new Date().toISOString(),
  });
}
