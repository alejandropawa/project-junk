const API_BASE =
  process.env.FOOTBALL_API_BASE_URL ?? "https://v3.football.api-sports.io";

export async function apiFootballFetch(
  path: string,
  search: Record<string, string | number | undefined>,
): Promise<{ ok: boolean; json: unknown; status: number }> {
  const key = process.env.FOOTBALL_API_KEY?.trim();
  if (!key) return { ok: false, json: null, status: 503 };

  const url = new URL(path, API_BASE);
  Object.entries(search).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const json = (await res.json()) as unknown;
  return { ok: res.ok, json, status: res.status };
}
