import { getDb } from "@/lib/db";
import { killfeedCsvResponse } from "@/lib/killfeed-export";

export async function GET(_request: Request, ctx: { params: Promise<{ scrimId: string; mapId: string }> }) {
  return killfeedCsvResponse(await getDb(), await ctx.params);
}
