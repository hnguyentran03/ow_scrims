/**
 * Candidates for a dynamic route segment whose encoding Next does not promise: the decoded form first,
 * then the raw segment. A segment that cannot be decoded (a literal "%") is tried raw only.
 */
export function nameCandidates(raw: string): string[] {
  let decoded: string | null;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = null;
  }
  return decoded !== null && decoded !== raw ? [decoded, raw] : [raw];
}
