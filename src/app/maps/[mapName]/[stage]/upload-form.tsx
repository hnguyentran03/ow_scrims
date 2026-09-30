"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/field";

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
      <Input type="file" name="file" accept=".png,.jpg,.jpeg,.webp" size="sm" />
      <Button type="submit" variant="primary" size="sm" pending={busy} pendingLabel="Uploading…">Upload image</Button>
      <span className="text-muted">PNG, JPEG, or WebP, up to 10 MB. Replacing an image clears its calibration.</span>
      {status && <span className="w-full text-ink">{status}</span>}
    </form>
  );
}
