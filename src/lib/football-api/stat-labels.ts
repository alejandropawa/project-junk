const STAT_LABELS_BY_TYPE_ID: Record<number, string> = {
  34: "Cornere",
  40: "Șuturi blocate",
  41: "Șuturi respinse",
  42: "Șuturi total",
  43: "Atacuri",
  44: "Atacuri periculoase",
  45: "Posesie",
  46: "Intervenții portar",
  47: "Penalty-uri",
  49: "Pase",
  50: "Pase precise",
  51: "Pase precise %",
  52: "Offside-uri",
  53: "Aruncări de la margine",
  54: "Lovituri libere",
  55: "Degajări",
  56: "Faulturi",
  57: "Lovituri de poartă",
  58: "Șuturi pe poartă",
  59: "Șuturi pe lângă poartă",
  60: "Intervenții",
  78: "Înlocuiri",
  79: "Tratament medical",
  80: "Goluri",
  81: "Goluri anulate",
  82: "Cartonașe",
  83: "Cartonașe roșii",
  84: "Cartonașe galbene",
  85: "Cartonașe galbene-roșii",
  86: "Penalty-uri ratate",
  87: "Penalty-uri marcate",
  88: "Penalty-uri apărate",
  99: "Centrări",
  100: "Centrări precise",
  106: "Dueluri câștigate",
  108: "Driblinguri reușite",
  109: "Intercepții",
};

const STAT_LABELS_BY_KEY: Record<string, string> = {
  attacks: "Atacuri",
  blocked_shots: "Șuturi blocate",
  cards: "Cartonașe",
  clearances: "Degajări",
  corners: "Cornere",
  crosses: "Centrări",
  dangerous_attacks: "Atacuri periculoase",
  fouls: "Faulturi",
  free_kicks: "Lovituri libere",
  goal_kicks: "Lovituri de poartă",
  goals: "Goluri",
  goalkeeper_saves: "Intervenții portar",
  injuries: "Tratament medical",
  interceptions: "Intercepții",
  offsides: "Offside-uri",
  passes: "Pase",
  penalties: "Penalty-uri",
  possession: "Posesie",
  red_cards: "Cartonașe roșii",
  saves: "Intervenții portar",
  shots_blocked: "Șuturi blocate",
  shots_insidebox: "Șuturi din careu",
  shots_off_goal: "Șuturi pe lângă poartă",
  shots_on_goal: "Șuturi pe poartă",
  shots_outsidebox: "Șuturi din afara careului",
  shots_total: "Șuturi total",
  substitutions: "Înlocuiri",
  tackles: "Intervenții",
  throwins: "Aruncări de la margine",
  yellow_cards: "Cartonașe galbene",
  yellowred_cards: "Cartonașe galbene-roșii",
};

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/%/g, " pct ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeFallback(raw: string): string {
  return normalizeKey(raw)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function fixtureStatisticLabelRo(
  typeId: number,
  apiName?: string | null,
  developerName?: string | null,
): string {
  const byType = STAT_LABELS_BY_TYPE_ID[typeId];
  if (byType) return byType;

  for (const raw of [developerName, apiName]) {
    if (!raw) continue;
    const translated = STAT_LABELS_BY_KEY[normalizeKey(raw)];
    if (translated) return translated;
  }

  if (apiName?.trim()) return humanizeFallback(apiName);
  if (developerName?.trim()) return humanizeFallback(developerName);
  return `Statistică ${typeId}`;
}
