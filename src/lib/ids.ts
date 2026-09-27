const INT4_MAX = 2147483647;

/** A URL segment as a positive int4: canonical decimal digits only, no sign, no leading zero, no whitespace. */
export function parsePositiveInt(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= INT4_MAX ? n : null;
}
