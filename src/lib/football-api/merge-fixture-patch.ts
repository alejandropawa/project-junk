import type { NormalizedFixture } from "@/lib/football-api/types";

/** Înlocuiește meciurile cu același `id` cu patch‑urile (polling live). */
export function mergeFixturePatch(
  prev: NormalizedFixture[],
  patches: NormalizedFixture[],
): NormalizedFixture[] {
  const m = new Map(patches.map((p) => [p.id, p]));
  return prev.map((f) => {
    const p = m.get(f.id);
    if (!p) return f;
    return {
      ...f,
      ...p,
      liveStatsSplit:
        p.liveStatsSplit !== undefined ? p.liveStatsSplit : f.liveStatsSplit,
    };
  });
}
