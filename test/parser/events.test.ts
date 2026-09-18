import { describe, expect, it } from "vitest";
import { EVENTS, EVENT_TYPES, type EventColumn } from "@/lib/parser/events";

const EXPECTED_COUNTS: Record<string, number> = {
  ability_1_used: 6, ability_2_used: 6, damage: 13, defensive_assist: 5, dva_remech: 5,
  echo_duplicate_end: 5, echo_duplicate_start: 6, healing: 12, hero_spawn: 6, hero_swap: 6,
  kill: 14, match_end: 4, match_start: 5, mercy_rez: 7, objective_captured: 7,
  objective_updated: 4, offensive_assist: 5, payload_progress: 5, player_stat: 38,
  point_progress: 5, remech_charged: 6, round_end: 9, round_start: 6, setup_complete: 3,
  ultimate_charged: 6, ultimate_end: 7, ultimate_start: 7,
};

describe("EVENTS", () => {
  it("declares all 27 event types with the documented column counts", () => {
    expect(EVENT_TYPES).toHaveLength(27);
    for (const type of EVENT_TYPES) {
      expect(EVENTS[type].length, type).toBe(EXPECTED_COUNTS[type]);
    }
  });

  it("starts every event with match_time and uses unique keys and columns", () => {
    for (const type of EVENT_TYPES) {
      const cols = EVENTS[type];
      expect(cols[0]).toMatchObject({ key: "matchTime", column: "match_time", kind: "real" });
      expect(new Set(cols.map((c) => c.key)).size).toBe(cols.length);
      expect(new Set(cols.map((c) => c.column)).size).toBe(cols.length);
    }
  });

  it("marks only trailing columns optional", () => {
    for (const type of EVENT_TYPES) {
      const cols: readonly EventColumn[] = EVENTS[type];
      const firstOptional = cols.findIndex((c) => c.optional);
      if (firstOptional === -1) continue;
      for (const c of cols.slice(firstOptional)) expect(c.optional, `${type}.${c.key}`).toBe(true);
    }
  });
});
