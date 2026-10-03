import { getDb } from "@/lib/db";
import { killfeedCsvResponse } from "@/lib/killfeed-export";

export async function GET(_request: Request, ctx: RouteContext<"/api/scrims/[scrimId]/maps/[mapId]/killfeed.csv">) {
  return killfeedCsvResponse(await getDb(), await ctx.params);
}
