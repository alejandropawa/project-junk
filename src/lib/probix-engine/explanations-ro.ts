import type {
  MarketCandidate,
  ProbixEngineInput,
  ProbixFeatures,
} from "@/lib/probix-engine/types";

const LEGACY_BOOKMAKER_DISCLAIMER_PREFIX =
  "Analiza Probix combină statisticile sezoniere";

/** Scoruri istorice salvate înainte să scoatem Disclaimer-ul generator. */
export function withoutLegacyProbixBookmakerDisclaimer(
  bullets: readonly string[],
): string[] {
  return bullets.filter(
    (line) => !line.trimStart().startsWith(LEGACY_BOOKMAKER_DISCLAIMER_PREFIX),
  );
}

function roDecimal(n: number, digits: number): string {
  return n.toFixed(digits).replace(".", ",");
}

function scorePhrase(
  homeGoals: number | null | undefined,
  awayGoals: number | null | undefined,
): string | null {
  if (
    typeof homeGoals !== "number" ||
    !Number.isFinite(homeGoals) ||
    typeof awayGoals !== "number" ||
    !Number.isFinite(awayGoals)
  ) {
    return null;
  }
  return `${Math.round(homeGoals)}–${Math.round(awayGoals)}`;
}

/** Cornere din `/fixtures/statistics` când API le trimite pentru cel puțin o parte. */
function liveCornerPair(
  ctx: ProbixEngineInput,
): { home: number; away: number } | null {
  const s = ctx.fixture.liveStatsSplit;
  if (!s) return null;
  const h = s.home.corners;
  const a = s.away.corners;
  const hOk = typeof h === "number" && Number.isFinite(h);
  const aOk = typeof a === "number" && Number.isFinite(a);
  if (!hOk && !aOk) return null;
  return {
    home: hOk ? Math.max(0, h) : 0,
    away: aOk ? Math.max(0, a) : 0,
  };
}

/**
 * Text pentru „Analiză” în UI: ton conversațional RO, amestec între medii (sezon)
 * și ce vine live din API-Football pe meciul curent când există.
 */
export function generateExplanationBullets(
  ctx: ProbixEngineInput,
  f: ProbixFeatures,
  picks: MarketCandidate[],
): string[] {
  const bullets: string[] = [];
  const nf = ctx.fixture;
  const homeN = nf.homeName;
  const awayN = nf.awayName;
  const score = scorePhrase(nf.homeGoals, nf.awayGoals);
  const liveCorners = liveCornerPair(ctx);
  const pace = roDecimal(f.cornerPace, 1);
  const lambdaRo = roDecimal(f.lambdaGoals, 1);

  if (nf.bucket === "live" && score != null) {
    bullets.push(
      `În desfășurare e ${score} între ${homeN} și ${awayN}. Mai jos legăm selecțiile de ce se vede acum pe teren și de obiceiurile din sezon.`,
    );
  } else if (nf.bucket === "finished" && score != null) {
    bullets.push(
      `La fluier a rămas ${score} între ${homeN} și ${awayN}. Contextul de mai jos e tot util dacă vrei să înțelegi cum am gândit combinația înainte de meci.`,
    );
  } else {
    bullets.push(
      `Meci între ${homeN} și ${awayN}. Ne uităm la ce au făcut în ultimele etape (acasă / în deplasare), nu la „feeling” gol.`,
    );
  }

  if (f.lambdaGoals >= 2.4) {
    bullets.push(
      `Pe goluri, ambele echipe adună suficient ca să ne așteptăm la un meci destul de deschis — în zona a ~${lambdaRo} goluri totale ca reper, din medii.`,
    );
  } else if (f.lambdaGoals <= 1.65) {
    bullets.push(
      `Pe goluri, cifrele sunt ceva mai strânse: undeva la ~${lambdaRo} goluri totale ca reper. Are sens să fii atent la sub-uri dacă jocul pornește prudent.`,
    );
  } else {
    bullets.push(
      `Pe goluri stăm la mijloc: ~${lambdaRo} goluri totale ca reper din ce au arătat până acum — nici festival, nici „sigur rămâne 0–0”.`,
    );
  }

  const useLiveCorners =
    liveCorners != null && (nf.bucket === "live" || nf.bucket === "finished");
  if (useLiveCorners && liveCorners) {
    const total = liveCorners.home + liveCorners.away;
    bullets.push(
      `La cornere, în meciul ăsta sunt ${total} pe tabelă (${liveCorners.home} ${homeN}, ${liveCorners.away} ${awayN}). În sezon, pe medii, echipele se învârt cam la ~${pace} cornere pe meci ca reper — compară ritmul din teren cu „obiceiul” din campionat.`,
    );
  } else if (f.cornerPace >= 10) {
    bullets.push(
      `Pe cornere, ambele echipe au obiceiul de a împinge meciurile spre multe faze fixe — în medie, pe datele noastre, cam ~${pace} cornere pe meci. Uită-te la cum se deschide jocul în primele 20–25 de minute.`,
    );
  } else {
    bullets.push(
      `Pe cornere, profilul e ceva mai liniștit: în medie, pe ce primim din API, undeva la ~${pace} cornere pe meci. Nu garantează nimic, dar ajută la praguri mai conservatoare dacă meciul rămâne cadențat.`,
    );
  }

  if (ctx.h2h.samples >= 3 && ctx.h2h.avgTotalGoals != null) {
    const ag = roDecimal(ctx.h2h.avgTotalGoals, 2);
    bullets.push(
      `Ultimele ${ctx.h2h.samples} întâlniri directe au avut cam ${ag} goluri în medie. Nu e regulă de fier, dar îți arată cum se comportă una lângă alta.`,
    );
  }

  const fh = Math.round(f.formStrengthHome * 100);
  const fa = Math.round(f.formStrengthAway * 100);
  if (Math.abs(fh - fa) >= 18) {
    const stronger = fh > fa ? homeN : awayN;
    const weaker = fh > fa ? awayN : homeN;
    bullets.push(
      `Forma recentă (ultimele rezultate) îi dă un mic avantaj lui ${stronger} față de ${weaker} în felul în care citim meciul — nu e tot tabloul, dar contează la risc.`,
    );
  }

  bullets.push(`Combinația pe care o propunem aici:`);
  for (const p of picks) {
    bullets.push(`— ${p.label}: ${p.selection}.`);
  }

  return bullets.slice(0, 14);
}
