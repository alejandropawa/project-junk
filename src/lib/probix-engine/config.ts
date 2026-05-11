/**
 * Greutăți deterministe — calibrare manuală; versiune la schimbări majore.
 */
export const PROBIX_ENGINE_VERSION = "probix-engine/1.3.4";

/** Ligi eligibile pentru motor (calitate ridicată, date consistente). */
export const PROBIX_ENGINE_LEAGUE_IDS = new Set<number>([
  39, 140, 78, 135, 61, 2, 3, 848,
]);

export const WEIGHTS = {
  recentForm: 0.25,
  attack: 0.2,
  defense: 0.2,
  context: 0.15,
  marketAgreement: 0.1,
  varianceGuard: 0.1,
} as const;

/** Prag minim încredere (agregare) — filtru slab pe pool înainte de scoring. */
export const MIN_MARKET_CONFIDENCE = 0.48;

/** Prag pragmatic leg 3 dacă apare în brute-force (nu forțat). */
export const MIN_MARKET_CONFIDENCE_LEG3 = 0.44;

export const MAX_LEGS = 3;

/** Permis 1 (single), 2 sau 3 (doar dacă scorul justifică). */
export const MIN_LEGS = 1;

/** Limite cote fallback sintetic / clamp marginal. */
export const DECIMAL_CLAMP = { min: 1.18, max: 2.75 } as const;

/** ─── Selecție edge + prob (per piață) ─── */
export const SELECTION_EDGE_WEIGHT = 0.45;

export const SELECTION_PROB_WEIGHT = 0.3;

export const SELECTION_DATA_WEIGHT = 0.15;

/** Penalizare agregare piețe (linii agresive). */
export const SELECTION_AGG_WEIGHT = 0.12;

export const SELECTION_PREF_WEIGHT = 0.08;

/** ─── Scor combinație (prioritate pentru P(câștig combinat); edge e al doilea). ─── */
export const COMBO_PROB_WEIGHT = 0.52;

export const COMBO_EDGE_WEIGHT = 0.28;

export const COMBO_CORR_WEIGHT = 0.2;

/** Niciun picior cu cotă agent nu trebuie să fie valorificat slab într-o combinație. */
export const BOOK_COMBO_MIN_LEG_EDGE = -0.035;

/** Dacă doi finaliști au `comboScore` apropiat, preferă probabilitatea combinată mai mare. */
export const FINALIST_SCORE_NEAR_EPS = 0.018;

/** Bias pentru pool brute-force — favorizează candidați cu p model mare (hit-rate). */
export const POOL_RANK_PROB_LEAN = 0.22;

/** Cote agent: în afara benzii → piața e exclusă dacă avem preț din API (lichiditate/slabă calitate). */
export const BOOK_ODDS_MIN = 1.2;

export const BOOK_ODDS_MAX = 3.5;

/**
 * Cotă combinată vizată (decimal): produsul cotelor picioarelor.
 * Dacă există candidat valid (single/double/triple) cu produs ≥ acest prag, este preferat;
 * dacă niciuna nu ajunge la prag, folosim tot finaliștii (evităm lipsă predicție).
 */
export const MIN_TARGET_COMBINED_DECIMAL = 2.0;

/** Prag calitate minimă pentru a accepta predicție. */
export const MIN_DATA_QUALITY_FOR_PREDICTION = 0.38;

/** Fereastră probabilitate model pentru pool (evită cozi extreme). */
export const MODEL_PROB_POOL_MIN = 0.41;

export const MODEL_PROB_POOL_MAX = 0.84;

/**
 * Sumă penalizări structurale pairwise peste prag → combinație respinsă.
 */
export const COMBO_HARD_CORRELATION_REJECT_SUM = 0.52;

/**
 * Platou pe reducerile aplicate la ∏p: comboProbAdj = ∏p * (1 - min(cap, sumPen)).
 */
export const COMBO_CORR_PROB_DAMAGE_CAP = 0.62;

/** Triplă doar dacă bate clar cea mai bună dublă. */
export const TRIPLE_SCORE_IMPROVE_OVER_DOUBLE = 0.042;

export const MAX_CANDIDATES_FOR_COMBO_SEARCH = 30;
