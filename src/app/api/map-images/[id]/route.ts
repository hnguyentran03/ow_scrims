import { getDb } from "@/lib/db";
import { mapImageResponse } from "@/lib/map-images";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return mapImageResponse(await getDb(), (await ctx.params).id);
}
