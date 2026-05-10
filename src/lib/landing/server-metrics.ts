import {
  fetchTodayTrackedFixtures,
  getBucharestDateString,
} from "@/lib/football-api/fetch-today";
import { summarizeHistoricEngineMetrics } from "@/lib/predictions/historic-metrics";
import { isPredictionCombinationResolved } from "@/lib/predictions/prediction-access";
import { fetchAllPredictionPayloadsForMetrics } from "@/lib/predictions/prediction-repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { HistoricEngineMetricsSummary } from "@/lib/predictions/historic-metrics";

/**
 * Metrici agregate pentru homepage (aceeași logică ca vizitatorul pe /api/historic/metrics),
 * fără HTTP intern - sigur la build și la edge.
 */
export async function getLandingMetricsPublic(): Promise<HistoricEngineMetricsSummary | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  try {
    let payloads = await fetchAllPredictionPayloadsForMetrics(admin);
    payloads = payloads.filter(isPredictionCombinationResolved);
    return summarizeHistoricEngineMetrics(payloads);
  } catch {
    return null;
  }
}

/** Număr real de meciuri live astăzi (ligile urmărite, timezone București), din același flux ca /meciuri. */
export async function getLandingLiveTodayMeta(): Promise<{
  liveCount: number | null;
  calendarDate: string;
}> {
  try {
    const data = await fetchTodayTrackedFixtures();
    if (!data.ok) {
      return { liveCount: null, calendarDate: data.date };
    }
    const liveCount = data.fixtures.filter((f) => f.bucket === "live").length;
    return { liveCount, calendarDate: data.date };
  } catch {
    return { liveCount: null, calendarDate: getBucharestDateString() };
  }
}
