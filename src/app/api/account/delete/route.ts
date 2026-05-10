import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id || !user.email) {
    return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  }

  const typed =
    typeof body === "object" &&
    body !== null &&
    "confirmationEmail" in body &&
    typeof (body as { confirmationEmail: unknown }).confirmationEmail ===
      "string"
      ? (body as { confirmationEmail: string }).confirmationEmail
          .trim()
          .toLowerCase()
      : "";

  if (typed !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      {
        error:
          "Adresa introdusă nu coincide cu e-mailul acestui cont. Scrie exact e-mailul contului pentru a confirma ștergerea.",
      },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Ștergerea contului nu este disponibilă: lipsește SUPABASE_SERVICE_ROLE_KEY pe server.",
      },
      { status: 503 },
    );
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return NextResponse.json(
      { error: delErr.message || "Ștergerea contului a eșuat." },
      { status: 500 },
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true as const });
}
