import type { SupabaseClient } from "@supabase/supabase-js";

export type CronLock = {
  name: string;
  owner: string;
  startedAt: number;
};

export type CronLockReleaseStats = {
  createdCount?: number;
  updatedCount?: number;
  metadata?: Record<string, unknown>;
};

function lockOwner(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${process.env.VERCEL_REGION ?? "local"}:${process.pid}:${random}`;
}

function logCronLock(
  event: "started" | "skipped" | "completed" | "release_failed",
  payload: Record<string, unknown>,
) {
  console.log(JSON.stringify({ scope: "cron_lock", event, ...payload }));
}

type AcquireCronLockRpcRow = {
  acquired: boolean;
  name: string;
  owner: string | null;
  expires_at: string;
  run_count: number;
  skipped_count: number;
};

type ReleaseCronLockRpcRow = {
  released: boolean;
  name: string;
  completed_count: number;
  created_count: number;
  updated_count: number;
};

export async function acquireCronLock(
  sb: SupabaseClient,
  name: string,
  ttlSeconds: number,
): Promise<CronLock | null> {
  const owner = lockOwner();
  const startedAt = Date.now();
  const { data, error } = await sb.rpc("acquire_cron_lock", {
    p_name: name,
    p_owner: owner,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    throw new Error(`${error.code ?? "?"} ${error.message}`.trim());
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | AcquireCronLockRpcRow
    | null
    | undefined;

  if (!row?.acquired) {
    logCronLock("skipped", {
      name,
      owner,
      heldBy: row?.owner ?? null,
      expiresAt: row?.expires_at ?? null,
      runCount: row?.run_count ?? null,
      skippedCount: row?.skipped_count ?? null,
    });
    return null;
  }

  logCronLock("started", {
    name,
    owner,
    expiresAt: row.expires_at,
    runCount: row.run_count,
    skippedCount: row.skipped_count,
  });

  return { name, owner, startedAt };
}

export async function releaseCronLock(
  sb: SupabaseClient,
  lock: CronLock,
  stats: CronLockReleaseStats = {},
): Promise<void> {
  const durationMs = Date.now() - lock.startedAt;
  const createdCount = Math.max(0, Math.floor(stats.createdCount ?? 0));
  const updatedCount = Math.max(0, Math.floor(stats.updatedCount ?? 0));
  const metadata = stats.metadata ?? {};

  const { data, error } = await sb.rpc("release_cron_lock", {
    p_name: lock.name,
    p_owner: lock.owner,
    p_duration_ms: durationMs,
    p_created_count: createdCount,
    p_updated_count: updatedCount,
    p_metadata: metadata,
  });

  if (error) {
    logCronLock("release_failed", {
      name: lock.name,
      owner: lock.owner,
      durationMs,
      createdCount,
      updatedCount,
      error: `${error.code ?? "?"} ${error.message}`.trim(),
    });
    return;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | ReleaseCronLockRpcRow
    | null
    | undefined;

  logCronLock(row?.released ? "completed" : "release_failed", {
    name: lock.name,
    owner: lock.owner,
    durationMs,
    createdCount,
    updatedCount,
    completedCount: row?.completed_count ?? null,
    totalCreatedCount: row?.created_count ?? null,
    totalUpdatedCount: row?.updated_count ?? null,
  });
}
