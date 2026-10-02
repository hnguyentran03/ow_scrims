import type { SideKey } from "@/lib/stats/sides";
import type { Role } from "@/lib/stats/heroes";

/** One accent per side, used by every map view and the charts. Validated for colour vision on the navy surface (2026-09-30). */
export const TEAM_COLORS: Record<SideKey, string> = { ours: "#1c8fdb", theirs: "#ee5a52" };

/** One hue per role for the team charts. Validated with the dataviz palette script on 2026-10-01 (dark, surface #111d33): lightness band, chroma, CVD ΔE 9.7 deutan and 8.9 tritan, normal ΔE 19.4, contrast at least 4.2:1. Unknown is the muted token. */
export const ROLE_COLORS: Record<Role, string> = { Tank: "#b58a28", Damage: "#c95a8a", Support: "#2f9ec9", Unknown: "#93a5c3" };
