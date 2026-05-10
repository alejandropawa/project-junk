/** API-Football poate întoarce `errors: []` sau `errors: {}` și la succes - doar liste/obecte nevăzute sunt erori reale. */
export function hasRealFootballApiErrors(errors: unknown): boolean {
  if (errors == null) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return String(errors).trim().length > 0;
}

export function formatFootballApiErrors(errors: unknown): string {
  if (errors == null) return "";
  if (typeof errors === "object" && !Array.isArray(errors)) {
    return Object.values(errors as Record<string, string>).join(" · ");
  }
  if (Array.isArray(errors)) return errors.map(String).join(" · ");
  return String(errors);
}
