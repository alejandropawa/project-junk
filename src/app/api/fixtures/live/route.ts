import { allowIpRequest, clientIpFromRequest } from "@/lib/rate-limit-ip";
import { fetchLiveFixtureSnapshotsByIds } from "@/lib/football-api/live-fixture-cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LIVE_POLL_MAX_PER_MIN = 48;
const LIVE_POLL_WINDOW_MS = 60_000;
const MAX_IDS = 30;

export async function GET(req: Request) {
  const ip = clientIpFromRequest(req);
  if (!allowIpRequest(ip, LIVE_POLL_MAX_PER_MIN, LIVE_POLL_WINDOW_MS)) {
    return Response.json(
      {
        error:
          "Prea multe cereri live. Asteapta putin sau reincarca pagina. (Limitare anti-abuz)",
      },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam?.trim()) {
    return Response.json({ fixtures: [] }, { status: 200 });
  }

  const ids = idsParam
    .split("-")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return Response.json({ fixtures: [] }, { status: 200 });
  }

  const sb = createServiceRoleClient();
  if (!sb) {
    return Response.json(
      { error: "Cache live indisponibil: SUPABASE_SERVICE_ROLE_KEY lipsa." },
      { status: 500 },
    );
  }

  const result = await fetchLiveFixtureSnapshotsByIds(sb, ids);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({
    fixtures: result.fixtures,
    stale: result.fixtures.some((fixture) => fixture.dataDelayed),
    message: result.fixtures.some((fixture) => fixture.dataDelayed)
      ? "data delayed"
      : null,
  });
}
