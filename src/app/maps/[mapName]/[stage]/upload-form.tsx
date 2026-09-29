"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm({ mapName, stage }: { mapName: string; stage: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = new FormData(e.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setStatus("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    const data = new FormData();
    data.append("mapName", mapName);
    data.append("stage", String(stage));
    data.append("file", file);
    setBusy(true);
    try {
      const res = await fetch("/api/map-images", { method: "POST", body: data });
      const body = (await res.json()) as { error?: string };
      if (res.ok) {
        setStatus("Uploaded. Any previous calibration for this stage was cleared.");
        router.refresh();
      } else {
        setStatus(body.error ?? "Upload failed.");
      }
    } catch {
      setStatus("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 text-sm">
      <input type="file" name="file" accept=".png,.jpg,.jpeg,.webp" className="text-zinc-300" />
      <button type="submit" disabled={busy} className="rounded bg-orange-500 px-3 py-1 font-medium text-black disabled:opacity-50">{busy ? "Uploading…" : "Upload image"}</button>
      <span className="text-zinc-400">PNG, JPEG, or WebP, up to 10 MB. Replacing an image clears its calibration.</span>
      {status && <span className="w-full text-zinc-300">{status}</span>}
    </form>
  );
}
