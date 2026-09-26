import type { Killfeed } from "./killfeed";

export const CSV_HEADER = ["fight", "round", "time", "kind", "attacker_team", "attacker", "attacker_hero", "victim_team", "victim", "victim_hero", "method", "critical"] as const;

/** Every field is quoted, with inner quotes doubled, regardless of content. */
export function csvField(value: string | number | boolean): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const line = (fields: ReadonlyArray<string | number | boolean>) => fields.map(csvField).join(",");

/** One row per killfeed entry. A round block marks a round's end, so the round column is one plus the round blocks passed. */
export function killfeedCsv(kf: Killfeed): string {
  const lines = [line(CSV_HEADER)];
  let round = 1;
  for (const block of kf.blocks) {
    if (block.kind === "round") {
      round += 1;
      continue;
    }
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
