/**
 * Limitare simplă pe IP pentru rute API publice (ex. polling live).
 *
 * NOTĂ producție (Vercel serverless): memoria nu e partajată între instanțe —
 * limita e „best effort” per izolat. Pentru abuz real folosește Redis / Vercel KV
 * sau Edge Config + rate limiting dedicat (ex. Upstash).
 */

type Bucket = { timestamps: number[] };

const globalStore = globalThis as typeof globalThis & {
  __probixRateLimit?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalStore.__probixRateLimit) {
    globalStore.__probixRateLimit = new Map();
  }
  return globalStore.__probixRateLimit;
}

function prune(bucket: Bucket, windowMs: number, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

/**
 * @returns `true` dacă cererea e permisă, `false` dacă s-a depășit limita.
 */
export function allowIpRequest(
  ip: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const key = ip.trim() || "unknown";
  const now = Date.now();
  const map = store();
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= maxRequests) {
    return false;
  }
  bucket.timestamps.push(now);
  return true;
}

export function clientIpFromRequest(req: Request): string {
  const h = (name: string) => req.headers.get(name)?.trim();
  const xff = h("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h("x-real-ip") ?? "unknown";
}
