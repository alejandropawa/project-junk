#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] != null) continue;

    process.env[key] = rawValue
      .replace(/^(['"])(.*)\1$/, "$2")
      .replace(/\\n/g, "\n");
  }
}

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--yes");
const dryRun = args.has("--dry-run");

if (!confirmed && !dryRun) {
  console.error(
    "Refusing to delete predictions without confirmation. Re-run with --yes, or use --dry-run to count rows.",
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const table = "prediction_reports";

const { count: beforeCount, error: countError } = await supabase
  .from(table)
  .select("fixture_id", { count: "exact", head: true });

if (countError) {
  console.error(`Could not count ${table}: ${countError.message}`);
  process.exit(1);
}

console.log(`${table} rows before delete: ${beforeCount ?? 0}`);

if (dryRun) {
  console.log("Dry run only. No rows deleted.");
  process.exit(0);
}

const { count: deletedCount, error: deleteError } = await supabase
  .from(table)
  .delete({ count: "exact" })
  .gte("fixture_id", 0);

if (deleteError) {
  console.error(`Delete failed: ${deleteError.message}`);
  process.exit(1);
}

console.log(`${table} rows deleted: ${deletedCount ?? 0}`);
console.log("Fresh start ready.");
