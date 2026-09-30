import type { SideKey } from "@/lib/stats/sides";

/** One accent per side, used by every map view and the charts. Validated for colour vision on the navy surface (2026-09-30). */
export const TEAM_COLORS: Record<SideKey, string> = { ours: "#1c8fdb", theirs: "#ee5a52" };
