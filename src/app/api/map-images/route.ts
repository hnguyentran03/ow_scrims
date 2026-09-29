import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { uploadMapImageResponse } from "@/lib/map-images";

export async function POST(request: Request) {
  const res = await uploadMapImageResponse(await getDb(), request);
  if (res.status === 201) {
    revalidatePath("/maps", "layout");
    revalidatePath("/scrims/[scrimId]/maps/[mapId]", "layout");
  }
  return res;
}
