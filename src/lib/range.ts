import type { DateRange } from "@/lib/db/queries";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a YYYY-MM-DD string naming a real calendar date. */
export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Reads ?from=&to= from a page's search params, dropping anything malformed. */
export function parseRange(params: Record<string, string | string[] | undefined>): DateRange {
  const range: DateRange = {};
  if (validDate(params.from)) range.from = params.from;
  if (validDate(params.to)) range.to = params.to;
  return range;
}

/** Reads ?hero= and keeps it only when it names one of `allowed` (the heroes the player actually played in range). */
export function parseHero(params: Record<string, string | string[] | undefined>, allowed: readonly string[]): string | undefined {
  const h = params.hero;
  return typeof h === "string" && allowed.includes(h) ? h : undefined;
}

/** Every query pair except the named keys, for forms that must carry unrelated filters along as hidden inputs. */
export function extraParams(params: Iterable<[string, string]>, omit: readonly string[]): Array<[string, string]> {
  return [...params].filter(([k]) => !omit.includes(k));
}

/** The query string for links that must keep the range (and any extras), or "" when nothing is set. */
export function rangeQuery(range: DateRange, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  if (range.from) q.set("from", range.from);
  if (range.to) q.set("to", range.to);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}
