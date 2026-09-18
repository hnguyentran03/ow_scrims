import { EVENTS, type EventColumn, type EventRow, type EventType } from "./events";
import { ParseError } from "./errors";

export const POSITION_RE = /^\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)$/;

export function isEventType(s: string): s is EventType {
  return Object.prototype.hasOwnProperty.call(EVENTS, s);
}

function coerceValue(col: EventColumn, raw: string, lineNumber: number): string | number | null {
  const value = raw.trim();
  if (value === "") {
    if (col.nullable) return null;
    throw new ParseError(`empty value for ${col.column}`, lineNumber);
  }
  switch (col.kind) {
    case "text":
      return value;
    case "position":
      return POSITION_RE.test(value) ? value : null;
    case "real": {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new ParseError(`expected a number for ${col.column}, got "${value}"`, lineNumber);
      return n;
    }
    case "integer": {
      const n = Number(value);
      if (!Number.isInteger(n)) throw new ParseError(`expected an integer for ${col.column}, got "${value}"`, lineNumber);
      return n;
    }
  }
}

export function coerceRow(eventType: EventType, fields: string[], lineNumber: number): EventRow {
  const columns: readonly EventColumn[] = EVENTS[eventType];
  if (fields.length > columns.length) {
    throw new ParseError(`${eventType} has ${fields.length} fields, expected at most ${columns.length}`, lineNumber);
  }
  const row: EventRow = {};
  columns.forEach((col, i) => {
    const raw = fields[i];
    if (raw === undefined) {
      if (col.optional) {
        row[col.key] = null;
        return;
      }
      throw new ParseError(`${eventType} is missing ${col.column}`, lineNumber);
    }
    row[col.key] = coerceValue(col, raw, lineNumber);
  });
  return row;
}
