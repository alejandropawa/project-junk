# Probix — Production readiness audit

**Scope:** Next.js App Router (16.x), TypeScript, Supabase, Vercel, API-Football, Odds API, cron, live polling.  
**Positioning:** Football analytics & live statistics SaaS (not gambling).  
**Audit date:** 2026-05-09 (codebase snapshot).

---

## Executive summary

The codebase shows **solid foundations** for a SaaS: server-side third-party API usage for live/cron paths, **Bearer-protected cron routes**, Supabase SSR via **`src/proxy.ts`** (Next.js 16), and historic APIs that **tier** anonymous vs authenticated responses.

**Highest residual risks** before scale: (1) **`prediction_reports` RLS** is broad for authenticated users; (2) **live polling** still fans out to API-Football from the server on each client poll — mitigated now with **IP rate limiting (best-effort)** but not a substitute for DB/cache fanout at 1000+ concurrent users; (3) **Content-Security-Policy** added globally may need tuning when you add analytics (Vercel / Sentry / PostHog).

**Implemented in this pass:** security headers (incl. CSP baseline + `X-Frame-Options`), Supabase session refresh via **`getClaims()`** in `proxy.ts`, **rate limiting** on `GET /api/fixtures/live`, this audit document.

---

## 1. Critical issues

| ID | Area | Finding | Mitigation |
|----|------|---------|------------|
| C1 | External API cost | `GET /api/fixtures/live` triggers **1 + N** API-Football calls per request (`/fixtures` + per-fixture `/fixtures/statistics`). Each connected browser polls on an interval (~48s in UI). Under many users, **server egress + API quota** scale with traffic unless centralized. | **Target architecture:** cron/worker → DB/cache → clients read via small API or Realtime. Short term: keep rate limit; add **Redis/KV** throttle; reduce poll frequency for anon; batch statistics if API supports multi-fixture. |
| C2 | RLS semantics | `prediction_reports`: policy `prediction_reports_select_authenticated` uses **`USING (true)`** — any authenticated user can **SELECT all rows**. Acceptable only if payloads are **non-sensitive** and intended as shared catalog. | If rows ever contain user-specific or embargoed data, replace with restrictive policies or **views** + grants. Add **`anon`: no policy** (implicit deny) — already no anon policy. |
| C3 | Service role | Historic routes use **service role** server-side then filter in app code for guests — correct pattern, but **one bug in repository** could leak pre-resolution data. | Code review + tests on `isPredictionCombinationResolved` / filter paths; consider **SQL-level** filtering for anon via `security definer` view. |

---

## 2. Medium issues

| ID | Area | Finding |
|----|------|---------|
| M1 | Rate limiting | In-memory IP limiter in `src/lib/rate-limit-ip.ts` is **per runtime instance** (Vercel: weak global guarantee). |
| M2 | Middleware / proxy | No **route-level auth gate** for `/cont/*` in proxy — pages rely on server checks / UX. Fine for now; central guard reduces drift. |
| M3 | Cron overlap | Vercel cron can overlap invocations; `predictionExists` + PK `(fixture_id, date_ro)` reduce duplicate writes — still monitor **double spend** on Odds API in narrow windows. |
| M4 | SEO | `sitemap.ts` omits `/cont/setari`, `/cont/abonament` (optional if you want them indexed — usually **noindex** for account). |
| M5 | Monitoring | No **Sentry / OpenTelemetry / structured logs** in repo. |

---

## 3. Low / hygiene

- Add **database indexes** on columns used in filters (`date_ro`, `fixture_id`, `created_at`) once query plans are measured in Supabase dashboard.
- **HSTS** is often set at CDN (Vercel) — avoid duplicating wrongly in `next.config` for local dev.
- **Lighthouse 95–100:** measure with PageSpeed on real deploy; likely wins: reduce client JS on marketing routes, `priority` on LCP image, ensure fonts `display: swap` (already on Inter).

---

## 4. Security findings (detailed)

### 4.1 Authentication & session

| Check | Status |
|-------|--------|
| SSR cookies | **Yes** — `src/lib/supabase/server.ts` + **`src/proxy.ts`** refresh session (`getClaims()`). |
| Client singleton | **Yes** — `src/lib/supabase/client.ts`. |
| Logout | **Yes** — `signOut`, global `others` option in account settings. |
| `CRON_SECRET` on cron GETs | **Yes** — `generate-predictions`, `revalidate-meciuri`. |
| `/api/account/delete` | **Yes** — session user + email confirmation + service role delete. |

**TODO (manual):** Rotate `CRON_SECRET` and **Supabase service role** on schedule; use **Vercel** environment separation (preview vs production).

### 4.2 API route exposure

| Route | Auth | Notes |
|-------|------|------|
| `/api/fixtures/live` | None (by design for public live UI) | **Now:** IP rate limit (48 req/min/IP). **Still:** protect API wallet with architecture in C1. |
| `/api/historic/*` | Uses `getUser()` for tiering | OK; uses admin client server-side. |
| Cron routes | Bearer | OK. |

### 4.3 Secrets

- **Never** expose `FOOTBALL_API_KEY`, `ODDS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` to `NEXT_PUBLIC_*`.
- `.env.example` documents keys — good.

### 4.4 Supabase RLS (migrations in repo)

**Table: `public.prediction_reports`**

- `ENABLE ROW LEVEL SECURITY` — **yes**.
- Policies in repo:
  - `prediction_reports_select_authenticated` — `FOR SELECT TO authenticated USING (true)`.

**Report:**  
- **Risk:** horizontal privilege escalation is irrelevant only if **all rows are intentionally public to any signed-in user** and payloads contain no secrets.  
- **Recommendation:** document that decision in an ADR; if adding per-user predictions table later, use **`auth.uid()`**-scoped policies.

**TODO (manual in Supabase SQL editor):** Audit **all other tables** in the remote project (not only files in this repo) — especially `auth` triggers, `storage`, and any `public` tables without RLS.

### 4.5 Security headers (implemented)

In `next.config.ts` for `/:path*`:

- `X-Content-Type-Options: nosniff`
- **`X-Frame-Options: DENY`**
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geo off)
- **`Content-Security-Policy`** — baseline with `frame-ancestors 'none'`, `upgrade-insecure-requests`, permissive `script-src` for Next.js compatibility.

**TODO:** When adding **Vercel Analytics / Sentry / PostHog**, extend `connect-src` / `script-src` (or switch to **nonces** via middleware/proxy).

---

## 5. Performance findings

- **Server Components:** main pages use RSC where appropriate; interactive islands use `"use client"` (drawers, live views) — reasonable.
- **Polling:** 48s interval limits load vs 1s naive polling — good. Align with **server cache TTL** when moving to DB-backed live state.
- **Images:** `next.config` `remotePatterns` for `media.api-sports.io` — good.
- **Revalidation:** cron + `revalidatePath` for key routes — good.

---

## 6. API optimization findings

- **Cron `generate-predictions`:** windowed engine + `predictionExists` — good duplicate guard.
- **Odds API:** optional key; wrapped in try/catch — good.
- **Live route:** batch `ids` up to 30 — good; still N+1 statistics calls — **batch or cache** when API allows.

---

## 7. Database findings

- Schema in repo is minimal (`prediction_reports` + audit columns). **Indexes:** add after profiling (`date_ro`, `created_at` common for historic).

**TODO:** Retention job for old `prediction_reports` / cold storage if table grows unbounded.

---

## 8. UX / product / legal (high level)

- **Legal pages** exist: `termeni`, `politica-confidentialitate`, `politica-cookies-disclaimer` — verify copy avoids “guaranteed profit” language (manual legal review).
- **Trial / Premium:** UI placeholders present; conversion flows — **product** TODO (instrumentation below).

---

## 9. Analytics & monitoring (recommendations)

| Tool | Use |
|------|-----|
| **Sentry** | Errors + performance traces |
| **Vercel Analytics / Speed Insights** | Web vitals |
| **PostHog or Plausible** | Product analytics (signup, prediction open, live retention) |

**TODO:** Add privacy-friendly consent if not strictly necessary cookies only.

---

## 10. Deployment checklist

- [ ] All production env vars set in Vercel (`NEXT_PUBLIC_*`, secrets, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, football/odds keys).
- [ ] Supabase **Auth URL** allowlist includes production domain + `/auth/callback`.
- [ ] **Cron** schedules aligned with API quotas (generate-predictions ~5 min, revalidate ~3h).
- [ ] **Smoke test** after deploy: login, live page with open fixtures, historic anon vs auth, cron 401 without secret.
- [ ] **RLS** audit completed in Supabase dashboard for **all** tables.
- [ ] **Backup** + disaster recovery for Supabase project.
- [ ] **CSP** validated in browser console (no blocked legitimate resources).

---

## Appendix — Code changes in this audit pass

| File | Change |
|------|--------|
| `next.config.ts` | `X-Frame-Options`, CSP header (+ comment for tightening). |
| `src/proxy.ts` | `getClaims()` instead of `getUser()`, matcher tweak, comments/TODO. |
| `src/lib/rate-limit-ip.ts` | **New** — sliding-window per IP (documented limits on serverless). |
| `src/app/api/fixtures/live/route.ts` | Rate limit + `429` + `Retry-After`. |
| `docs/PRODUCTION_READINESS_AUDIT.md` | This report. |

---

*End of report. Re-run this audit after major feature additions (payments, realtime DB path, new external APIs).*
