import { revalidatePath } from "next/cache";
import { acquireCronLock, releaseCronLock } from "@/lib/cron/locks";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron Vercel - la ~3 ore invalidă cache pentru /meciuri (meci mutate/anulate).
 * Setează CRON_SECRET în Vercel și același valoare în cron Authorization.
 */
export async function GET(req: Request) {
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
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY lipsa." },
      { status: 500 },
    );
  }

  const lock = await acquireCronLock(sb, "revalidate-meciuri", 120);
  if (!lock) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "cron_lock_held",
      at: new Date().toISOString(),
    });
  }

  try {
    revalidatePath("/meciuri");
    revalidatePath("/predictii");

    return Response.json({
      ok: true,
      revalidated: ["/meciuri", "/predictii"],
      stats: {
        createdRows: 0,
        updatedRows: 0,
      },
      at: new Date().toISOString(),
    });
  } finally {
    await releaseCronLock(sb, lock, {
      createdCount: 0,
      updatedCount: 0,
      metadata: {
        revalidated: ["/meciuri", "/predictii"],
      },
    });
  }
}
