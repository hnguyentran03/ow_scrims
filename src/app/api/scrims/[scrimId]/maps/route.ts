import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleUpload, MAX_UPLOAD_BYTES, UploadError } from "@/lib/upload";

export async function POST(request: Request, ctx: { params: Promise<{ scrimId: string }> }) {
  const scrimId = Number((await ctx.params).scrimId);
  if (!Number.isInteger(scrimId) || scrimId <= 0) {
    return NextResponse.json({ error: "invalid scrim id" }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file is larger than 50MB" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  let side: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    file = form.get("file");
    side = form.get("ourSide");
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });
  if (side !== "1" && side !== "2" && side !== "auto") return NextResponse.json({ error: "choose which team was yours" }, { status: 400 });

  try {
    const ourSide = side === "auto" ? "auto" : side === "1" ? 1 : 2;
    const result = await handleUpload(await getDb(), { scrimId, file, ourSide });
    revalidatePath(`/scrims/${scrimId}`);
    revalidatePath("/");
    revalidatePath("/team", "layout");
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message, ...err.details }, { status: err.status });
    console.error("upload failed", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
