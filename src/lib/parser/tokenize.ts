import { ParseError } from "./errors";

export interface RawLine {
  lineNumber: number;
  eventType: string;
  fields: string[];
}

const PREFIX = /^\[\d\d:\d\d:\d\d\]\s*$/;

/** Split on commas, but not inside `(x, y, z)` position tuples. */
export function splitFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of line) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function tokenizeLog(text: string): RawLine[] {
  const out: RawLine[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const lineNumber = i + 1;
    const tokens = splitFields(line);
    if (!PREFIX.test(tokens[0] ?? "")) {
      throw new ParseError("missing [HH:MM:SS] timestamp prefix", lineNumber);
    }
    const eventType = (tokens[1] ?? "").trim();
    if (eventType === "") throw new ParseError("missing event type", lineNumber);
    out.push({ lineNumber, eventType, fields: tokens.slice(2) });
  }
  return out;
}
