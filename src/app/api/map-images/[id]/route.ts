import { getDb } from "@/lib/db";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { mapImageResponse } from "@/lib/map-images";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!POSITION_FEATURES_ENABLED) return Response.json({ error: "map features are switched off" }, { status: 404 });
  return mapImageResponse(await getDb(), (await ctx.params).id);
}
