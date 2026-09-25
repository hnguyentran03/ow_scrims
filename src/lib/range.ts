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
