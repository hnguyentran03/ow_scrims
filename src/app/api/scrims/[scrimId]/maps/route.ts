import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parsePositiveInt } from "@/lib/ids";
import { handleUpload, MAX_UPLOAD_BYTES, UploadError } from "@/lib/upload";

export async function POST(request: Request, ctx: RouteContext<"/api/scrims/[scrimId]/maps">) {
  const scrimId = parsePositiveInt((await ctx.params).scrimId);
  if (scrimId === null) {
    return NextResponse.json({ error: "invalid scrim id" }, { status: 400 });
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader === null) return NextResponse.json({ error: "content-length header required" }, { status: 411 });
  const contentLength = Number(lengthHeader);
  if (!Number.isFinite(contentLength) || contentLength < 0) return NextResponse.json({ error: "invalid content-length" }, { status: 400 });
  if (contentLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "file is larger than 50MB" }, { status: 413 });

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
    if (err instanceof UploadError) return NextResponse.json({ ...err.details, error: err.message }, { status: err.status });
    console.error("upload failed", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
