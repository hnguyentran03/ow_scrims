export type SideKey = "ours" | "theirs";

export interface Sides {
  ours: string;
  theirs: string;
}

export function sides(map: { team1Name: string; team2Name: string; ourSide: number }): Sides {
  return map.ourSide === 1
    ? { ours: map.team1Name, theirs: map.team2Name }
    : { ours: map.team2Name, theirs: map.team1Name };
}

export function sideOf(team: string, s: Sides): SideKey | null {
  if (team === s.ours) return "ours";
  if (team === s.theirs) return "theirs";
  return null;
}
