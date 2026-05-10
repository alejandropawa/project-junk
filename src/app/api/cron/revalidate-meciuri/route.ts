import { revalidatePath } from "next/cache";

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

  revalidatePath("/meciuri");
  revalidatePath("/predictii");

  return Response.json({
    ok: true,
    revalidated: ["/meciuri", "/predictii"],
    at: new Date().toISOString(),
  });
}
