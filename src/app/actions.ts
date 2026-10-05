"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, getWritableDb } from "@/lib/db";
import { createScrim, deleteMap, deleteMapImage, deleteScrim, getMap, getReplayRows, setCalibration, setMapBans, setMapWinner } from "@/lib/db/queries";
import { parseBanInput } from "@/lib/bans";
import { parseCalibrationInput } from "@/lib/calibration-input";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { ghostFrom, type Ghost } from "@/lib/ghost";
import { deleteRawLog } from "@/lib/logs";
import { deleteImageFile } from "@/lib/map-images";
import { validateScrimInput, type CreateScrimState } from "@/lib/scrim-input";
import { applyAffine, invertAffine, solveAffine, type Calibration } from "@/lib/stats/calibration";
import { buildReplay } from "@/lib/stats/replay";
import { sides } from "@/lib/stats/sides";

function requireId(n: unknown): number {
  if (!Number.isInteger(n) || (n as number) <= 0) throw new Error("invalid id");
  return n as number;
}

/** Validates, creates, and redirects to the new scrim; on a bad field it returns the values and messages for the form to show inline. */
export async function createScrimAction(_prev: CreateScrimState, formData: FormData): Promise<CreateScrimState> {
  const { values, errors } = validateScrimInput({ name: formData.get("name"), date: formData.get("date"), opponentName: formData.get("opponentName") });
  if (errors) return { values, errors };
  const id = await createScrim(await getWritableDb(), values);
  revalidatePath("/");
  redirect(`/scrims/${id}`);
}

export async function setMapWinnerAction(scrimId: number, mapId: number, side: 1 | 2): Promise<void> {
  scrimId = requireId(scrimId);
  mapId = requireId(mapId);
  if (side !== 1 && side !== 2) throw new Error("invalid id");
  const db = await getWritableDb();
  const data = await getMap(db, mapId);
  if (!data || data.scrim.id !== scrimId) throw new Error("map not found");
  await setMapWinner(db, mapId, side);
  revalidatePath(`/scrims/${scrimId}`);
  revalidatePath(`/scrims/${scrimId}/maps/${mapId}`, "layout");
}

export async function deleteMapAction(scrimId: number, mapId: number): Promise<void> {
  scrimId = requireId(scrimId);
  mapId = requireId(mapId);
  const rawLogPath = await deleteMap(await getWritableDb(), mapId);
  await deleteRawLog(rawLogPath);
  revalidatePath(`/scrims/${scrimId}`);
  redirect(`/scrims/${scrimId}`);
}

export async function deleteScrimAction(scrimId: number): Promise<void> {
  scrimId = requireId(scrimId);
  const paths = await deleteScrim(await getWritableDb(), scrimId);
  await Promise.all(paths.map(deleteRawLog));
  revalidatePath("/");
  redirect("/");
}

export async function setMapBansAction(scrimId: number, mapId: number, side: 1 | 2, heroes: string[]): Promise<void> {
  const input = parseBanInput({ scrimId, mapId, side, heroes });
  const db = await getWritableDb();
  const data = await getMap(db, input.mapId);
  if (!data || data.scrim.id !== input.scrimId) throw new Error("map not found");
  await setMapBans(db, input.mapId, input.side, input.heroes);
  revalidatePath(`/scrims/${input.scrimId}`);
  revalidatePath(`/scrims/${input.scrimId}/maps/${input.mapId}`, "layout");
  revalidatePath("/team", "layout");
}

/** A ghost overlay source: another window of the same stage on the same base map. Null for anything else, including a source window with no position samples. */
export async function getGhostAction(input: { mapId: number; window: number; sourceMapId: number; sourceWindow: number }): Promise<Ghost | null> {
  // Mirrors the replay page's own gate.
  if (!POSITION_FEATURES_ENABLED) return null;
  const mapId = requireId(input.mapId);
  const sourceMapId = requireId(input.sourceMapId);
  if (!Number.isInteger(input.window) || !Number.isInteger(input.sourceWindow) || input.window < 0 || input.sourceWindow < 0) return null;
  const db = await getDb();
  const own = await getMap(db, mapId);
  const source = await getMap(db, sourceMapId);
  if (!own || !source || own.map.mapName !== source.map.mapName) return null;
  const build = async (data: NonNullable<Awaited<ReturnType<typeof getMap>>>) =>
    buildReplay({ map: data.map, sides: sides(data.map), rows: await getReplayRows(db, data.map.id), images: [] });
  const ownReplay = mapId === sourceMapId ? null : await build(own);
  const sourceReplay = await build(source);
  const ownStages = (ownReplay ?? sourceReplay).stages;
  const ownStage = ownStages[input.window]?.stage;
  const sourceStage = sourceReplay.stages[input.sourceWindow]?.stage;
  if (ownStage === undefined || sourceStage === undefined || ownStage !== sourceStage) return null;
  const label = `${source.scrim.name} · ${source.scrim.date} · ${sourceReplay.stages[input.sourceWindow].label}`;
  const ghost = ghostFrom(sourceReplay, input.sourceWindow, input.window, label);
  if (!ghost || !ghost.players.some((p) => p.segments.length > 0)) return null;
  return ghost;
}

const MAPS_PATHS = () => {
  revalidatePath("/maps", "layout");
  revalidatePath("/scrims/[scrimId]/maps/[mapId]", "layout");
};

/** Solves and stores a stage calibration. Returns an error message instead of throwing so the client can show it. */
export async function setCalibrationAction(raw: unknown): Promise<{ error: string } | null> {
  if (!POSITION_FEATURES_ENABLED) return { error: "Map features are switched off." };
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
  const ok = await setCalibration(await getWritableDb(), input.id, JSON.stringify(calibration), { width: input.width, height: input.height });
  if (!ok) return { error: "Image not found." };
  MAPS_PATHS();
  return null;
}

export async function clearCalibrationAction(id: number): Promise<void> {
  if (!POSITION_FEATURES_ENABLED) return;
  id = requireId(id);
  await setCalibration(await getWritableDb(), id, null);
  MAPS_PATHS();
}

export async function deleteMapImageAction(id: number): Promise<void> {
  if (!POSITION_FEATURES_ENABLED) return;
  id = requireId(id);
  const row = await deleteMapImage(await getWritableDb(), id);
  if (row) await deleteImageFile(row.filename);
  MAPS_PATHS();
}
