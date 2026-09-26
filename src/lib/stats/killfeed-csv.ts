import type { Killfeed } from "./killfeed";

export const CSV_HEADER = ["fight", "round", "time", "kind", "attacker_team", "attacker", "attacker_hero", "victim_team", "victim", "victim_hero", "method", "critical"] as const;

/**
 * Every field is quoted, with inner quotes doubled, regardless of content. A string starting
 * with a character that Excel or LibreOffice would interpret as a formula prefix (=, +, -, @,
 * tab, or CR) is itself prefixed with an apostrophe so it round-trips as text, not a formula.
 */
export function csvField(value: string | number | boolean): string {
  const s = String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

const line = (fields: ReadonlyArray<string | number | boolean>) => fields.map(csvField).join(",");

/**
 * One row per killfeed entry. A round block marks a round's end, so a fight that straddles a
 * capture is attributed to the later round, matching where the killfeed page draws the divider.
 */
export function killfeedCsv(kf: Killfeed): string {
  const lines = [line(CSV_HEADER)];
  const roundEnds = kf.blocks.flatMap((b) => (b.kind === "round" ? [b.roundNumber] : []));
  let roundIdx = 0;
  let lastRoundNumber = 0;
  for (const block of kf.blocks) {
    if (block.kind === "round") {
      lastRoundNumber = block.roundNumber;
      roundIdx += 1;
      continue;
    }
    const round = roundIdx < roundEnds.length ? roundEnds[roundIdx] : lastRoundNumber + 1;
    for (const e of block.entries) {
      lines.push(
        line(
          e.kind === "rez"
            ? [block.fight.index, round, e.time.toFixed(2), "rez", e.resurrecter.team, e.resurrecter.name, e.resurrecter.hero, e.resurrectee.team, e.resurrectee.name, e.resurrectee.hero, "Resurrect", false]
            : [block.fight.index, round, e.time.toFixed(2), e.kind, e.attacker.team, e.attacker.name, e.attacker.hero, e.victim.team, e.victim.name, e.victim.hero, e.method, e.critical],
        ),
      );
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}
