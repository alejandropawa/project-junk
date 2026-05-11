import type { ProbixOddsSource } from "@/lib/predictions/types";

/** O observație la nivel de picior după settlement. */
export type PickObservation = {
  marketId: string;
  leagueName: string;
  modelProb: number;
  won: boolean;
  oddsSource?: ProbixOddsSource;
};
