const ODDS_BASE = "https://api.odds-api.io/v3";

export type OddsApiSimpleEvent = {
  id: number;
  home: string;
  away: string;
  date: string;
  status?: string;
  league?: { name?: string; slug?: string };
};

export type OddsMarketOdds = Record<string, string | number | undefined>;

export type OddsMarketRow = {
  name: string;
  odds: OddsMarketOdds[];
};

export type OddsApiOddsBody = {
  id: number;
  home?: string;
  away?: string;
  bookmakers?: Record<string, OddsMarketRow[]>;
};

export async function fetchOddsEventsWindow(
  apiKey: string,
  fromIso: string,
  toIso: string,
): Promise<OddsApiSimpleEvent[]> {
  const qs = new URLSearchParams();
  qs.set("apiKey", apiKey);
  qs.set("sport", "football");
  qs.set("from", fromIso);
  qs.set("to", toIso);
  qs.set("limit", "80");
  qs.set("status", "pending,live");

  const res = await fetch(`${ODDS_BASE}/events?${qs}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as OddsApiSimpleEvent[];
}

export async function fetchEventOdds(
  apiKey: string,
  eventId: number,
  bookmakersCsv: string,
): Promise<OddsApiOddsBody | null> {
  const qs = new URLSearchParams();
  qs.set("apiKey", apiKey);
  qs.set("bookmakers", bookmakersCsv);
  qs.set("eventId", String(eventId));
  const res = await fetch(`${ODDS_BASE}/odds?${qs}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as OddsApiOddsBody;
}
