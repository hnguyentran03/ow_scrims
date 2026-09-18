import { coerceRow, isEventType } from "./coerce";
import { ParseError } from "./errors";
import type { EventRow, EventType } from "./events";
import { sanitizeLine } from "./sanitize";
import { tokenizeLog } from "./tokenize";

export const MIN_LOG_BYTES = 1024;

export interface ParsedLog {
  events: Partial<Record<EventType, EventRow[]>>;
  warnings: string[];
}

export function parseLog(text: string): ParsedLog {
  if (Buffer.byteLength(text, "utf8") < MIN_LOG_BYTES) {
    throw new ParseError("log is under 1KB; the Workshop writes stub files for lobbies that never started");
  }

  const events: Partial<Record<EventType, EventRow[]>> = {};
  const warnings: string[] = [];

  for (const raw of tokenizeLog(text)) {
    const line = sanitizeLine(raw);
    if (line === null) continue;
    if (!isEventType(line.eventType)) {
      warnings.push(`line ${line.lineNumber}: unknown event type ${line.eventType}`);
      continue;
    }
    const row = coerceRow(line.eventType, line.fields, line.lineNumber);
    (events[line.eventType] ??= []).push(row);
  }

  const starts = events.match_start?.length ?? 0;
  if (starts !== 1) throw new ParseError(`expected exactly one match_start line, found ${starts}`);
  const ends = events.match_end?.length ?? 0;
  if (ends !== 1) throw new ParseError(`expected exactly one match_end line, found ${ends}`);

  return { events, warnings };
}
