import { revalidatePath } from "next/cache";
import { getWritableDb } from "@/lib/db";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { uploadMapImageResponse } from "@/lib/map-images";

export async function POST(request: Request) {
  if (!POSITION_FEATURES_ENABLED) return Response.json({ error: "map features are switched off" }, { status: 404 });
  const res = await uploadMapImageResponse(await getWritableDb(), request);
  if (res.status === 201) {
    revalidatePath("/maps", "layout");
    revalidatePath("/scrims/[scrimId]/maps/[mapId]", "layout");
  }
  return res;
}
