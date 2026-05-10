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

export function generateExplanationBullets(
  ctx: ProbixEngineInput,
  f: ProbixFeatures,
  picks: MarketCandidate[],
): string[] {
  const bullets: string[] = [];

  bullets.push(
    `Ritm ofensiv sintetizat (λ goluri estimate): ~${f.lambdaGoals.toFixed(2)} goluri marcate combinativ pe rundă echivalentă.`,
  );

  if (f.cornerPace >= 9) {
    bullets.push(
      `Presiune pe faze fixe: media indicilor de cornere este ridicată (~${f.cornerPace.toFixed(1)}), ceea ce susține piețe de ritm în joc deschis.`,
    );
  } else if (f.cornerPace <= 8) {
    bullets.push(
      `Cornerele medii sugerează un meci puțin mai controlat teritorial (~${f.cornerPace.toFixed(1)} / echipă), relevant pentru praguri mai conservatoare.`,
    );
  }

  if (ctx.h2h.samples >= 3 && ctx.h2h.avgTotalGoals != null) {
    bullets.push(
      `În ultimele ${ctx.h2h.samples} confruntări directe, media golurilor a fost ~${ctx.h2h.avgTotalGoals.toFixed(2)}.`,
    );
  }

  bullets.push(`Selecții semnalate deterministic (fără învățare automată):`);

  for (const p of picks) {
    bullets.push(
      `- ${p.label}: ${p.selection} (cotă estimată orientativă @${p.estimatedDecimal.toFixed(2)}).`,
    );
  }

  return bullets.slice(0, 8);
}
