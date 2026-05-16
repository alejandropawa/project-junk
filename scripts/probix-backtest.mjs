import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((x) => x.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const json = process.argv.includes("--json");
const limitRaw = argValue("limit");
const limit = limitRaw ? Math.max(1, Number(limitRaw)) : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local/.env.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});

function settlement(payload) {
  return payload?.settlement ?? "pending";
}

function isResolvedBet(payload) {
  const s = settlement(payload);
  return (s === "won" || s === "lost") && (payload?.picks?.length ?? 0) > 0;
}

function isAvoided(payload) {
  return (
    payload?.predictionOutcome === "NO_BET" ||
    payload?.safetyStatus === "NO_BET" ||
    (payload?.noBetReason && !(payload?.picks?.length))
  );
}

function combinedOdds(payload) {
  const own = Number(payload?.estimatedCombinedDecimal);
  if (Number.isFinite(own) && own > 1) return own;
  const picks = payload?.picks ?? [];
  if (!picks.length) return null;
  const product = picks.reduce((m, p) => {
    const d = Number(p.decimal);
    return Number.isFinite(d) && d > 1 ? m * d : m;
  }, 1);
  return product > 1 ? product : null;
}

function familyFromMarketId(id) {
  if (!id) return "unknown";
  if (id.includes("231") || id === "btts_yes" || id === "btts_no") return "btts";
  if (id.includes("239") || id.startsWith("dc_")) return "dc";
  if (id.includes("corner")) return "corners";
  if (id.includes("card")) return "cards";
  if (id.includes("foul")) return "fouls";
  if (id.includes("234") || id.includes("235") || id.includes("236") || id.includes("1679")) return "goals";
  if (id.includes("331") || id.includes("332") || id.includes("333") || id.includes("334")) return "goals";
  return "unknown";
}

function confidenceBucket(payload) {
  const c = Number(payload?.confidenceScore);
  if (!Number.isFinite(c)) return "unknown";
  if (c < 55) return "50-55%";
  if (c < 60) return "55-60%";
  if (c < 65) return "60-65%";
  if (c < 70) return "65-70%";
  return "70%+";
}

function pickClvPct(pick) {
  const direct = Number(pick?.closingLineValuePct ?? pick?.clvPercent);
  if (Number.isFinite(direct)) return direct;
  const published = Number(pick?.publishedOdds ?? pick?.openingOdds ?? pick?.decimal);
  const closing = Number(pick?.closingOdds ?? pick?.currentOdds);
  if (!Number.isFinite(published) || !Number.isFinite(closing) || published <= 1 || closing <= 1) {
    return null;
  }
  return (published / closing - 1) * 100;
}

function emptyClvBucket(key) {
  return {
    key,
    picks: 0,
    beatClosing: 0,
    sumClvPct: 0,
    averageClvPct: null,
    beatClosingPct: null,
  };
}

function addClvBucket(map, key, clvPct) {
  if (clvPct == null || !Number.isFinite(clvPct)) return;
  const row = map.get(key) ?? emptyClvBucket(key);
  row.picks += 1;
  if (clvPct > 0) row.beatClosing += 1;
  row.sumClvPct += clvPct;
  map.set(key, row);
}

function finalizeClvMap(map, preferredOrder = []) {
  const order = new Map(preferredOrder.map((x, i) => [x, i]));
  return [...map.values()]
    .map((row) => ({
      key: row.key,
      picks: row.picks,
      beatClosing: row.beatClosing,
      beatClosingPct: row.picks ? round((row.beatClosing / row.picks) * 100, 1) : null,
      averageClvPct: row.picks ? round(row.sumClvPct / row.picks, 3) : null,
    }))
    .sort((a, b) => {
      const oa = order.has(a.key) ? order.get(a.key) : 999;
      const ob = order.has(b.key) ? order.get(b.key) : 999;
      if (oa !== ob) return oa - ob;
      return b.picks - a.picks || a.key.localeCompare(b.key);
    });
}

function emptyBucket(key) {
  return {
    key,
    bets: 0,
    won: 0,
    lost: 0,
    averageOdds: null,
    profitUnits: 0,
    roiPct: null,
    winRatePct: null,
  };
}

function addBucket(map, key, payload) {
  if (!isResolvedBet(payload)) return;
  const row = map.get(key) ?? emptyBucket(key);
  const s = settlement(payload);
  const odds = combinedOdds(payload);
  row.bets += 1;
  row.oddsSum = (row.oddsSum ?? 0) + (odds ?? 0);
  row.oddsCount = (row.oddsCount ?? 0) + (odds == null ? 0 : 1);
  if (s === "won") {
    row.won += 1;
    row.profitUnits += odds != null ? odds - 1 : 0;
  } else {
    row.lost += 1;
    row.profitUnits -= 1;
  }
  map.set(key, row);
}

function finalizeBucket(row) {
  const decided = row.won + row.lost;
  return {
    key: row.key,
    bets: row.bets,
    won: row.won,
    lost: row.lost,
    winRatePct: decided ? round((row.won / decided) * 100, 1) : null,
    averageOdds: row.oddsCount ? round(row.oddsSum / row.oddsCount, 2) : null,
    profitUnits: round(row.profitUnits, 3),
    roiPct: row.bets ? round((row.profitUnits / row.bets) * 100, 1) : null,
  };
}

function finalizeMap(map, preferredOrder = []) {
  const order = new Map(preferredOrder.map((x, i) => [x, i]));
  return [...map.values()]
    .map(finalizeBucket)
    .sort((a, b) => {
      const oa = order.has(a.key) ? order.get(a.key) : 999;
      const ob = order.has(b.key) ? order.get(b.key) : 999;
      if (oa !== ob) return oa - ob;
      return b.bets - a.bets || a.key.localeCompare(b.key);
    });
}

function round(n, digits) {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

async function fetchRows() {
  const page = 1000;
  const out = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("prediction_reports")
      .select("fixture_id,date_ro,league_name,payload")
      .order("date_ro", { ascending: false })
      .range(from, from + page - 1);
    const { data, error } = await q;
    if (error) throw new Error(`${error.code ?? "?"} ${error.message}`);
    if (!data?.length) break;
    out.push(...data);
    if (limit && out.length >= limit) return out.slice(0, limit);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

function summarize(rows) {
  const payloads = rows.map((r) => ({ row: r, payload: r.payload ?? {} }));
  const avoided = payloads.filter(({ payload }) => isAvoided(payload));
  const bets = payloads.filter(({ payload }) => payload?.picks?.length);
  const resolved = bets.filter(({ payload }) => isResolvedBet(payload));
  const legacyResolved = resolved.filter(
    ({ payload }) =>
      !payload.predictionOutcome && !payload.safetyStatus && !payload.volatilityReport,
  );
  const gatedResolved = resolved.filter(
    ({ payload }) =>
      (payload.predictionOutcome || payload.safetyStatus) &&
      payload.predictionOutcome !== "NO_BET" &&
      payload.safetyStatus !== "NO_BET",
  );

  const all = new Map();
  const bySafetyStatus = new Map();
  const byVolatility = new Map();
  const byMarketFamily = new Map();
  const byComboSize = new Map();
  const byConfidence = new Map();
  const clvAll = new Map();
  const clvByFamily = new Map();
  const clvByLeague = new Map();
  const clvByConfidence = new Map();
  const clvBySafety = new Map();

  for (const { row, payload } of resolved) {
    addBucket(all, "all_resolved_bets", payload);
    addBucket(
      bySafetyStatus,
      payload.safetyStatus ?? payload.predictionOutcome ?? "LEGACY_BEFORE_GATES",
      payload,
    );
    addBucket(byVolatility, payload.volatilityReport?.level ?? "LEGACY_UNKNOWN", payload);
    addBucket(byComboSize, payload.comboType ?? `${payload.picks.length}-leg`, payload);
    addBucket(byConfidence, confidenceBucket(payload), payload);

    const families = new Set(
      (payload.picks ?? []).map((p) => familyFromMarketId(p.marketId)),
    );
    for (const family of families) addBucket(byMarketFamily, family, payload);

    for (const pick of payload.picks ?? []) {
      const clv = pickClvPct(pick);
      const family = familyFromMarketId(pick.marketId);
      addClvBucket(clvAll, "all_picks", clv);
      addClvBucket(clvByFamily, family, clv);
      addClvBucket(clvByLeague, row.league_name ?? payload.calibrationSnapshot?.leagueName ?? "unknown", clv);
      addClvBucket(clvByConfidence, confidenceBucket(payload), clv);
      addClvBucket(
        clvBySafety,
        payload.safetyStatus ?? payload.predictionOutcome ?? "LEGACY_BEFORE_GATES",
        clv,
      );
    }
  }

  const shadowRows = payloads.filter(({ payload }) => payload.shadowMode);
  const summarizeList = (key, list) => {
    const m = new Map();
    for (const x of list) addBucket(m, key, x.payload);
    return finalizeMap(m)[0] ?? emptyBucket(key);
  };
  const shadow = {
    totalRows: shadowRows.length,
    ungatedWouldBet: shadowRows.filter(
      ({ payload }) => payload.shadowMode.ungated.pickCount > 0,
    ).length,
    gatedWouldBet: shadowRows.filter(
      ({ payload }) => payload.shadowMode.gated.pickCount > 0,
    ).length,
    avoidedByGates: shadowRows.filter(
      ({ payload }) =>
        payload.shadowMode.ungated.pickCount > 0 &&
        payload.shadowMode.gated.outcome === "NO_BET",
    ).length,
    downgradedToSingle: shadowRows.filter(
      ({ payload }) =>
        payload.shadowMode.ungated.pickCount > 1 &&
        payload.shadowMode.gated.pickCount === 1,
    ).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    totalRows: payloads.length,
    totalPredictions: bets.length,
    totalAvoidedMatches: avoided.length,
    totalResolvedBets: resolved.length,
    winRateBeforeGates: summarizeList("legacy_before_gates", legacyResolved),
    winRateAfterGates: summarizeList("after_gates", gatedResolved),
    allResolved: finalizeMap(all)[0] ?? emptyBucket("all_resolved_bets"),
    bySafetyStatus: finalizeMap(bySafetyStatus, [
      "SAFE_BET",
      "MEDIUM_RISK",
      "VOLATILE_AVOID",
      "LEGACY_BEFORE_GATES",
    ]),
    byVolatilityBucket: finalizeMap(byVolatility, [
      "LOW",
      "MEDIUM",
      "HIGH",
      "EXTREME",
      "LEGACY_UNKNOWN",
    ]),
    byMarketFamily: finalizeMap(byMarketFamily),
    byComboSize: finalizeMap(byComboSize, ["single", "double", "triple"]),
    byConfidenceBucket: finalizeMap(byConfidence, [
      "50-55%",
      "55-60%",
      "60-65%",
      "65-70%",
      "70%+",
      "unknown",
    ]),
    hitRateSingles: finalizeMap(byComboSize).find((x) => x.key === "single") ?? null,
    hitRateDoubles: finalizeMap(byComboSize).find((x) => x.key === "double") ?? null,
    hitRateTriples: finalizeMap(byComboSize).find((x) => x.key === "triple") ?? null,
    noBetReasons: avoided.reduce((acc, { payload }) => {
      const key = payload.noBetReason ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    clv: {
      overall: finalizeClvMap(clvAll)[0] ?? emptyClvBucket("all_picks"),
      byMarketFamily: finalizeClvMap(clvByFamily),
      byLeague: finalizeClvMap(clvByLeague),
      byConfidenceBucket: finalizeClvMap(clvByConfidence, [
        "50-55%",
        "55-60%",
        "60-65%",
        "65-70%",
        "70%+",
        "unknown",
      ]),
      bySafetyStatus: finalizeClvMap(clvBySafety, [
        "SAFE_BET",
        "MEDIUM_RISK",
        "VOLATILE_AVOID",
        "LEGACY_BEFORE_GATES",
      ]),
    },
    shadowMode: shadow,
  };
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows?.length) {
    console.log("  no data");
    return;
  }
  for (const r of rows) {
    console.log(
      `  ${r.key.padEnd(20)} bets=${String(r.bets).padStart(4)} win=${String(r.winRatePct ?? "n/a").padStart(5)}% avgOdds=${String(r.averageOdds ?? "n/a").padStart(5)} roi=${String(r.roiPct ?? "n/a").padStart(6)}% profit=${String(r.profitUnits).padStart(7)}`,
    );
  }
}

function printClvTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows?.length) {
    console.log("  no data");
    return;
  }
  for (const r of rows) {
    console.log(
      `  ${r.key.padEnd(24)} picks=${String(r.picks).padStart(4)} beatClose=${String(r.beatClosingPct ?? "n/a").padStart(5)}% avgCLV=${String(r.averageClvPct ?? "n/a").padStart(7)}%`,
    );
  }
}

function printReport(report) {
  console.log(`Probix backtest report (${report.generatedAt})`);
  console.log(`Rows: ${report.totalRows}`);
  console.log(`Predictions: ${report.totalPredictions}`);
  console.log(`Avoided matches: ${report.totalAvoidedMatches}`);
  console.log(`Resolved bets: ${report.totalResolvedBets}`);
  console.log(
    `Before gates: win=${report.winRateBeforeGates.winRatePct ?? "n/a"}% roi=${report.winRateBeforeGates.roiPct ?? "n/a"}% bets=${report.winRateBeforeGates.bets}`,
  );
  console.log(
    `After gates:  win=${report.winRateAfterGates.winRatePct ?? "n/a"}% roi=${report.winRateAfterGates.roiPct ?? "n/a"}% bets=${report.winRateAfterGates.bets}`,
  );
  console.log(
    `Shadow: rows=${report.shadowMode.totalRows}, ungatedWouldBet=${report.shadowMode.ungatedWouldBet}, gatedWouldBet=${report.shadowMode.gatedWouldBet}, avoidedByGates=${report.shadowMode.avoidedByGates}, downgradedToSingle=${report.shadowMode.downgradedToSingle}`,
  );
  printTable("By safety status", report.bySafetyStatus);
  printTable("By volatility bucket", report.byVolatilityBucket);
  printTable("By market family", report.byMarketFamily);
  printTable("By combo size", report.byComboSize);
  printTable("By confidence bucket", report.byConfidenceBucket);
  console.log(
    `\nCLV overall: picks=${report.clv.overall.picks}, beatClosing=${report.clv.overall.beatClosingPct ?? "n/a"}%, avgCLV=${report.clv.overall.averageClvPct ?? "n/a"}%`,
  );
  printClvTable("CLV by market family", report.clv.byMarketFamily);
  printClvTable("CLV by league", report.clv.byLeague);
  printClvTable("CLV by confidence bucket", report.clv.byConfidenceBucket);
  printClvTable("CLV by safety status", report.clv.bySafetyStatus);
  console.log("\nNO_BET reasons");
  console.log(report.noBetReasons);
}

const rows = await fetchRows();
const report = summarize(rows);
if (json) console.log(JSON.stringify(report, null, 2));
else printReport(report);
