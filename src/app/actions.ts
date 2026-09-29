"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { createScrim, deleteMap, deleteMapImage, deleteScrim, getMap, setCalibration, setMapBans, setMapWinner } from "@/lib/db/queries";
import { parseBanInput } from "@/lib/bans";
import { parseCalibrationInput } from "@/lib/calibration-input";
import { deleteRawLog } from "@/lib/logs";
import { deleteImageFile } from "@/lib/map-images";
import { applyAffine, invertAffine, solveAffine, type Calibration } from "@/lib/stats/calibration";

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
  revalidatePath(`/scrims/${scrimId}/maps/${mapId}`, "layout");
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

export async function setMapBansAction(scrimId: number, mapId: number, side: 1 | 2, heroes: string[]): Promise<void> {
  const input = parseBanInput({ scrimId, mapId, side, heroes });
  const db = await getDb();
  const data = await getMap(db, input.mapId);
  if (!data || data.scrim.id !== input.scrimId) throw new Error("map not found");
  await setMapBans(db, input.mapId, input.side, input.heroes);
  revalidatePath(`/scrims/${input.scrimId}`);
  revalidatePath(`/scrims/${input.scrimId}/maps/${input.mapId}`, "layout");
  revalidatePath("/team", "layout");
}

const MAPS_PATHS = () => {
  revalidatePath("/maps", "layout");
  revalidatePath("/scrims/[scrimId]/maps/[mapId]", "layout");
};

/** Solves and stores a stage calibration. Returns an error message instead of throwing so the client can show it. */
export async function setCalibrationAction(raw: unknown): Promise<{ error: string } | null> {
  const input = parseCalibrationInput(raw);
  if (!input) return { error: "Invalid calibration." };
  const affine = solveAffine(input.pairs);
  if (!affine) return { error: "Pick points that are not on one line." };
  let objective: Calibration["objective"] = null;
  if (input.objective) {
    const inverse = invertAffine(affine);
    if (!inverse) return { error: "Pick points that are not on one line." };
    // The inverse maps pixels to world: feed (px, py) through the x/z slots and read (x, z) back out of px/py.
    const w = applyAffine(inverse, { x: input.objective.px, z: input.objective.py });
    objective = { x: w.px, z: w.py };
  }
  const calibration: Calibration = { pairs: input.pairs, affine, objective };
  const ok = await setCalibration(await getDb(), input.id, JSON.stringify(calibration), { width: input.width, height: input.height });
  if (!ok) return { error: "Image not found." };
  MAPS_PATHS();
  return null;
}

export async function clearCalibrationAction(id: number): Promise<void> {
  id = requireId(id);
  await setCalibration(await getDb(), id, null);
  MAPS_PATHS();
}

export async function deleteMapImageAction(id: number): Promise<void> {
  id = requireId(id);
  const row = await deleteMapImage(await getDb(), id);
  if (row) await deleteImageFile(row.filename);
  MAPS_PATHS();
}
