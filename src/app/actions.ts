"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { createScrim, deleteMap, deleteScrim, setMapWinner } from "@/lib/db/queries";
import { deleteRawLog } from "@/lib/logs";

function requireId(n: unknown): number {
  if (!Number.isInteger(n) || (n as number) <= 0) throw new Error("invalid id");
  return n as number;
}

export async function createScrimAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const opponentName = String(formData.get("opponentName") ?? "").trim();
  if (!name || !opponentName || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Name, date, and opponent are required.");
  }
  const id = await createScrim(await getDb(), { name, date, opponentName });
  revalidatePath("/");
  redirect(`/scrims/${id}`);
}

export async function setMapWinnerAction(scrimId: number, mapId: number, side: 1 | 2): Promise<void> {
  scrimId = requireId(scrimId);
  mapId = requireId(mapId);
  if (side !== 1 && side !== 2) throw new Error("invalid id");
  await setMapWinner(await getDb(), mapId, side);
  revalidatePath(`/scrims/${scrimId}`);
  revalidatePath(`/scrims/${scrimId}/maps/${mapId}`);
}

export async function deleteMapAction(scrimId: number, mapId: number): Promise<void> {
  scrimId = requireId(scrimId);
  mapId = requireId(mapId);
  const rawLogPath = await deleteMap(await getDb(), mapId);
  await deleteRawLog(rawLogPath);
  revalidatePath(`/scrims/${scrimId}`);
  redirect(`/scrims/${scrimId}`);
}

export async function deleteScrimAction(scrimId: number): Promise<void> {
  scrimId = requireId(scrimId);
  const paths = await deleteScrim(await getDb(), scrimId);
  await Promise.all(paths.map(deleteRawLog));
  revalidatePath("/");
  redirect("/");
}
