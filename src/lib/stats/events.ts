import { fightIndexAt, groupFights, killKind, type Fight, type KillLike } from "./fights";
import { dedupeRounds, roundCapturer, type RoundEndLike, type RoundLike } from "./rounds";
import { sideOf, sides, type SideKey } from "./sides";
import { pairUltimates, DOUBLE_CAST_SECONDS, type UltLike } from "./ultimates";
import { casterKills, ultDetails } from "./ult-analysis";

export { pairUltimates, DOUBLE_CAST_SECONDS };
export { fightIndexAt };
export { casterKills };
export type { UltLike };

export interface EventMapLike {
  team1Name: string;
  team2Name: string;
  ourSide: number;
  mapType: string;
}

export interface TimedRow {
  matchTime: number;
}

export interface CaptureLike extends TimedRow {
  roundNumber: number;
  capturingTeam: string;
}

export interface SwapLike extends TimedRow {
  playerTeam: string;
  playerName: string;
  playerHero: string;
  previousHero: string;
}

export interface EventRows {
  matchStarts: TimedRow[];
  matchEnds: TimedRow[];
  roundStarts: RoundLike[];
  roundEnds: RoundEndLike[];
  captures: CaptureLike[];
  swaps: SwapLike[];
  ultStarts: UltLike[];
  ultEnds: UltLike[];
  kills: KillLike[];
}

interface Base {
  time: number;
  team: SideKey | null;
}

export type EventEntry =
  | (Base & { kind: "match_start" | "match_end" })
  | (Base & { kind: "round_start"; roundNumber: number })
  | (Base & { kind: "round_end"; roundNumber: number; capturingTeam: string | null })
  | (Base & { kind: "capture"; teamName: string; isPoint: boolean })
  | (Base & { kind: "swap"; player: string; from: string; to: string })
  | (Base & { kind: "ult"; player: string; hero: string; fightIndex: number | null; kills: number; conversionKills: number; diedDuringUlt: boolean })
  | (Base & { kind: "ult_kill"; player: string; hero: string; kills: number })
  | (Base & { kind: "fight"; fightIndex: number; winner: string | null; ours: number; theirs: number })
  | (Base & { kind: "multikill"; player: string; hero: string; kills: number; fightIndex: number })
  | (Base & { kind: "ajax"; player: string; fightIndex: number | null });

export type EventKind = EventEntry["kind"];

export interface EventTotals {
  rounds: number;
  fights: number;
  ults: number;
  ultKills: number;
  multikills: number;
  swaps: number;
  captures: number;
}

export interface Events {
  entries: EventEntry[];
  totals: EventTotals;
}

export type FilterKey = "all" | "highlights" | "ultimates" | "fights" | "swaps" | "objectives";

export const FILTER_KEYS: FilterKey[] = ["all", "highlights", "ultimates", "fights", "swaps", "objectives"];

/** Kinds shown per filter; null means every kind. */
export const FILTERS: Record<FilterKey, EventKind[] | null> = {
  all: null,
  highlights: ["ult", "ult_kill", "multikill", "ajax"],
  ultimates: ["ult", "ult_kill"],
  fights: ["fight"],
  swaps: ["swap"],
  objectives: ["capture", "round_start", "round_end", "match_start", "match_end"],
};

const KIND_PRIORITY: Record<EventKind, number> = {
  match_start: 0, round_start: 1, round_end: 2, match_end: 3, capture: 4, fight: 5, swap: 6, ult: 7, ult_kill: 8, multikill: 9, ajax: 10,
};

export const MULTIKILL_MIN = 3;

export function findMultikills(fights: Fight[]): Array<{ team: string; player: string; hero: string; kills: number; time: number; fightIndex: number }> {
  const out: Array<{ team: string; player: string; hero: string; kills: number; time: number; fightIndex: number }> = [];
  for (const fight of fights) {
    const byPlayer = new Map<string, { team: string; player: string; hero: string; kills: number; time: number }>();
    for (const k of fight.kills) {
      if (killKind(k) !== "kill") continue;
      const key = `${k.attackerTeam}|${k.attackerName}`;
      const entry = byPlayer.get(key) ?? { team: k.attackerTeam, player: k.attackerName, hero: k.attackerHero ?? "", kills: 0, time: k.matchTime };
      entry.kills += 1;
      byPlayer.set(key, entry);
    }
    for (const entry of byPlayer.values()) {
      if (entry.kills >= MULTIKILL_MIN) out.push({ ...entry, fightIndex: fight.index });
    }
  }
  return out;
}

/** A Lúcio dying at the same match time as their own ultimate_end: the ult was cancelled by the death. */
export function findAjaxes(kills: KillLike[], ultEnds: UltLike[]): Array<{ time: number; team: string; player: string }> {
  return kills
    .filter(
      (k) =>
        k.victimHero === "Lúcio" &&
        ultEnds.some((e) => e.playerTeam === k.victimTeam && e.playerName === k.victimName && Math.abs(e.matchTime - k.matchTime) < 1e-6),
    )
    .map((k) => ({ time: k.matchTime, team: k.victimTeam, player: k.victimName }));
}

export function buildEvents(map: EventMapLike, rows: EventRows): Events {
  const s = sides(map);
  const team = (name: string) => sideOf(name, s);
  const fights = groupFights(rows.kills);
  const roundStarts = dedupeRounds(rows.roundStarts);
  const roundEnds = dedupeRounds(rows.roundEnds);
  const isPoint = map.mapType === "Control" || map.mapType === "Flashpoint";
  const entries: EventEntry[] = [];

  for (const r of rows.matchStarts) entries.push({ kind: "match_start", time: r.matchTime, team: null });
  for (const r of rows.matchEnds) entries.push({ kind: "match_end", time: r.matchTime, team: null });
  for (const r of roundStarts) entries.push({ kind: "round_start", time: r.matchTime, team: null, roundNumber: r.roundNumber });
  roundEnds.forEach((r, i) => {
    const capturingTeam = roundCapturer(r, roundEnds[i - 1], map);
    entries.push({ kind: "round_end", time: r.matchTime, team: capturingTeam ? team(capturingTeam) : null, roundNumber: r.roundNumber, capturingTeam });
  });

  const captures = rows.captures.filter((c) => c.capturingTeam === map.team1Name || c.capturingTeam === map.team2Name);
  for (const c of captures) entries.push({ kind: "capture", time: c.matchTime, team: team(c.capturingTeam), teamName: c.capturingTeam, isPoint });

  const swaps = rows.swaps.filter((w) => w.matchTime > 0);
  for (const w of swaps) entries.push({ kind: "swap", time: w.matchTime, team: team(w.playerTeam), player: w.playerName, from: w.previousHero, to: w.playerHero });

  const ults = ultDetails(rows.ultStarts, rows.ultEnds, rows.kills);
  let ultKills = 0;
  for (const { start, casterKills: kills, conversionKills, diedDuringUlt } of ults) {
    const hero = start.playerHero ?? "";
    const side = team(start.playerTeam);
    entries.push({ kind: "ult", time: start.matchTime, team: side, player: start.playerName, hero, fightIndex: fightIndexAt(start.matchTime, fights), kills, conversionKills, diedDuringUlt });
    if (kills > 0) {
      ultKills += 1;
      entries.push({ kind: "ult_kill", time: start.matchTime, team: side, player: start.playerName, hero, kills });
    }
  }

  for (const f of fights) {
    entries.push({
      kind: "fight", time: f.start, team: f.winner ? team(f.winner) : null, fightIndex: f.index, winner: f.winner,
      ours: f.killsByTeam[s.ours] ?? 0, theirs: f.killsByTeam[s.theirs] ?? 0,
    });
  }

  const multikills = findMultikills(fights);
  for (const m of multikills) entries.push({ kind: "multikill", time: m.time, team: team(m.team), player: m.player, hero: m.hero, kills: m.kills, fightIndex: m.fightIndex });

  for (const a of findAjaxes(rows.kills, rows.ultEnds)) entries.push({ kind: "ajax", time: a.time, team: team(a.team), player: a.player, fightIndex: fightIndexAt(a.time, fights) });

  entries.sort((a, b) => a.time - b.time || KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);

  return {
    entries,
    totals: { rounds: roundStarts.length, fights: fights.length, ults: ults.length, ultKills, multikills: multikills.length, swaps: swaps.length, captures: captures.length },
  };
}
