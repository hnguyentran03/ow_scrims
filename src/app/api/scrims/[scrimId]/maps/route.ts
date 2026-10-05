import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDb, getWritableSandbox } from "@/lib/db";
import { SandboxBusyError, sandboxLogDir } from "@/lib/db/sandbox";
import { sandboxMaxMaps } from "@/lib/db/sandbox-env";
import { maps, scrims } from "@/lib/db/schema";
import { parsePositiveInt } from "@/lib/ids";
import { handleUpload, maxUploadBytes, parseUpload, tooLargeMessage, UploadError } from "@/lib/upload";

export async function POST(request: Request, ctx: RouteContext<"/api/scrims/[scrimId]/maps">) {
  const scrimId = parsePositiveInt((await ctx.params).scrimId);
  if (scrimId === null) {
    return NextResponse.json({ error: "invalid scrim id" }, { status: 400 });
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader === null) return NextResponse.json({ error: "content-length header required" }, { status: 411 });
  const contentLength = Number(lengthHeader);
  if (!Number.isFinite(contentLength) || contentLength < 0) return NextResponse.json({ error: "invalid content-length" }, { status: 400 });
  if (contentLength > maxUploadBytes()) return NextResponse.json({ error: tooLargeMessage() }, { status: 413 });

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

    // Settle everything that can refuse this upload before a sandbox is cloned for it:
    // a bad scrim id or a file that does not parse must not cost a CREATE DATABASE.
    // getDb() is the visitor's live sandbox when they have one and the public copy
    // otherwise — the same scrims the write will land next to.
    const probe = await getDb();
    const [scrim] = await probe.select({ id: scrims.id }).from(scrims).where(eq(scrims.id, scrimId));
    if (!scrim) return NextResponse.json({ error: "scrim not found" }, { status: 404 });
    const upload = await parseUpload(file);

    const { db, sandboxId } = await getWritableSandbox();
    if (sandboxId !== null) {
      // Per-sandbox disk quota. The count includes the snapshot's own maps, so
      // SANDBOX_MAX_MAPS has to stay comfortably above however many it ships with.
      const [{ n }] = await db.select({ n: count() }).from(maps);
      if (n >= sandboxMaxMaps()) return NextResponse.json({ error: "this sandbox is full; reset it to start over" }, { status: 413 });
    }

    const result = await handleUpload(db, { scrimId, upload, ourSide, logDir: sandboxId ? sandboxLogDir(sandboxId) : undefined });
    revalidatePath(`/scrims/${scrimId}`);
    revalidatePath("/");
    revalidatePath("/team", "layout");
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof SandboxBusyError) return NextResponse.json({ error: err.message }, { status: 429 });
    if (err instanceof UploadError) return NextResponse.json({ ...err.details, error: err.message }, { status: err.status });
    console.error("upload failed", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
