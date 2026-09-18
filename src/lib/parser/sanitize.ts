import type { RawLine } from "./tokenize";

/**
 * Normalise Workshop quirks before validation:
 * - newer builds censor the `kill` event type to `****`
 * - censored names or values contain `*`; Parsertime maps them to "0"
 * - `mercy_rez` lines are sometimes written with empty fields; drop them
 * - suicides and environmental kills have attacker team "All Teams"; copy the victim in
 */
export function sanitizeLine(line: RawLine): RawLine | null {
  const eventType = line.eventType === "****" ? "kill" : line.eventType;
  const fields = line.fields.map((f) => (f.includes("*") ? "0" : f));

  if (eventType === "mercy_rez" && fields.some((f) => f === "")) return null;

  if (eventType === "kill" && fields[1] === "All Teams") {
    fields[1] = fields[4];
    fields[2] = fields[5];
    fields[3] = fields[6];
  }

  return { lineNumber: line.lineNumber, eventType, fields };
}
