export const BUCHAREST_TZ = "Europe/Bucharest";

export function getBucharestDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUCHAREST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Interval YYYY-MM-DD ± N zile în calendară (UTC corect pentru ora București). */
export function shiftBucharestDateRo(dateRo: string, deltaDays: number): string {
  const [y, m, d] = dateRo.split("-").map(Number);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return dateRo;
  }
  const t = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUCHAREST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

/** An de start sezon (UE), din perspectiva zilei urmărite (lunile 7–12 → an curent altfel an precedent). */
/** O zi validă pentru historic (≤ azi București) în luna vizibilă: ultima zi a lunii dacă luna e înaintea lunii curente, altfel chiar ziua curentă. */
export function defaultSelectableDateRoInMonth(
  year: number,
  month: number,
  todayRo: string,
): string {
  const [ty, tm] = todayRo.split("-").map(Number);
  if (!Number.isFinite(ty) || !Number.isFinite(tm)) return todayRo;

  const viewYm = year * 100 + month;
  const todayYm = ty * 100 + tm;

  const daysInMonth = new Date(year, month, 0).getDate();

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastOfMonthRo = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  if (viewYm < todayYm) {
    return lastOfMonthRo;
  }
  if (viewYm === todayYm) {
    return todayRo <= lastOfMonthRo ? todayRo : lastOfMonthRo;
  }

  /* lună după ziua curentă - în UI nu ajungem aici dacă sunt dezactivate butoanele */
  return todayRo;
}

export function defaultEuropeanSeasonYearFromTrackedDay(): number {
  const dash = getBucharestDateString();
  const [y, m] = dash.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return new Date().getFullYear();
  return m >= 7 ? y : y - 1;
}
