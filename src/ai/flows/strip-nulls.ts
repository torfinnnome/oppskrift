/**
 * LLMs frequently emit `null` for optional fields instead of omitting the key.
 * The recipe-parsing schemas accept that (via .nullable().optional()), but
 * downstream code expects the field to be simply absent — normalize
 * null → undefined, recursively.
 *
 * Note: this must stay out of 'use server' modules — every export there is
 * treated as a Server Action and must be async.
 */
export function stripNulls<T>(value: T): T {
  if (value === null) return undefined as T;
  if (Array.isArray(value)) return value.map((v) => stripNulls(v)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripNulls(v);
      if (stripped !== undefined) out[k] = stripped;
    }
    return out as T;
  }
  return value;
}
