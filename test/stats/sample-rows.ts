import { readFileSync } from "node:fs";
import type { KillLike } from "@/lib/stats/fights";
import type { UltLike } from "@/lib/stats/ultimates";
import { parseLog } from "@/lib/parser/parse";

/** Ult and kill rows of a sample log, shaped like the stats modules' inputs. */
export const sampleRows = (name: string) => {
  const ev = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8")).events;
  return {
    starts: (ev.ultimate_start ?? []) as unknown as UltLike[],
    ends: (ev.ultimate_end ?? []) as unknown as UltLike[],
    charged: (ev.ultimate_charged ?? []) as unknown as UltLike[],
    kills: (ev.kill ?? []) as unknown as KillLike[],
  };
};
