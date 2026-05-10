/**
 * Greutăți deterministe - calibrare manuală; versiune la schimbări majore.
 * Sumele din fiecare strat trebuie să rămână interpretabile (nu învățare automată).
 */
export const PROBIX_ENGINE_VERSION = "probix-engine/1.2.0";

/** Ligi eligibile pentru motor (calitate ridicată, date consistente). */
export const PROBIX_ENGINE_LEAGUE_IDS = new Set<number>([
  39, 140, 78, 135, 61, 2, 3, 848,
]);

export const WEIGHTS = {
  /** Formă recentă (șir W/D/L + goluri). */
  recentForm: 0.25,
  /** Presiune ofensivă / finalizare. */
  attack: 0.2,
  /** Permisivitate defensivă. */
  defense: 0.2,
  /** Context (H2H, disponibilitate date). */
  context: 0.15,
  /** Consistență piețe / acord între semnale. */
  marketAgreement: 0.1,
  /** Stabilitate varianță (penalizare combinații riscante). */
  varianceGuard: 0.1,
} as const;

/** Prag minim de încredere pe o piață (0–1) pentru a fi candidat. */
export const MIN_MARKET_CONFIDENCE = 0.56;

/** Prag strict pentru a 3-a selecție. */
export const MIN_MARKET_CONFIDENCE_LEG3 = 0.52;

/** Produs probabilități (independență aprox.) - țintă mai joasă ⇒ cote combinate mai mari (>2). */
export const TARGET_PROB_PRODUCT = 0.38;

export const MAX_PROB_PRODUCT = 0.5;

export const MIN_PROB_PRODUCT = 0.27;

/** Cotă combinată minimă țintă (după selecție + eventual boost). */
export const MIN_COMBINED_DECIMAL_PROBIX = 2;

/** Limite cote afișate / estimate (margini agenți). */
export const DECIMAL_CLAMP = { min: 1.18, max: 2.75 } as const;

/** Penalizare încredere dacă al doilea picior e din aceeași familie de risc. */
export const CORRELATION_PENALTY = 0.12;

export const MAX_LEGS = 3;

export const MIN_LEGS = 2;
