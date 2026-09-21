"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { orderUploads } from "@/lib/upload-order";

type SideChoice = "auto" | "1" | "2";

type Status =
  | { kind: "queued" }
  | { kind: "uploading" }
  | { kind: "done"; mapName: string; warnings: string[] }
  | { kind: "needs-side"; team1Name: string; team2Name: string; team1: string[]; team2: string[]; side: "1" | "2" }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

interface Item {
  file: File;
  status: Status;
}

interface UploadBody {
  error?: string;
  mapName?: string;
  warnings?: string[];
  needsSide?: boolean;
  team1Name?: string;
  team2Name?: string;
  team1?: string[];
  team2?: string[];
}

export function AddMapForm({ scrimId }: { scrimId: number }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStatus = (index: number, status: Status) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status } : it)));

  async function upload(file: File, side: SideChoice): Promise<Status> {
    const data = new FormData();
    data.append("file", file);
    data.append("ourSide", side);
    try {
      const res = await fetch(`/api/scrims/${scrimId}/maps`, { method: "POST", body: data });
      const body = (await res.json()) as UploadBody;
      if (res.ok) return { kind: "done", mapName: body.mapName ?? file.name, warnings: body.warnings ?? [] };
      if (res.status === 422 && body.needsSide) {
        return { kind: "needs-side", team1Name: body.team1Name ?? "Team 1", team2Name: body.team2Name ?? "Team 2", team1: body.team1 ?? [], team2: body.team2 ?? [], side: "1" };
      }
      if (/already uploaded/.test(body.error ?? "")) return { kind: "duplicate" };
      return { kind: "error", message: body.error ?? "Upload failed." };
    } catch {
      return { kind: "error", message: "Upload failed." };
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const side = String(data.get("ourSide") ?? "auto") as SideChoice;
    if (files.length === 0 || files.some((f) => !/\.(txt|log)$/i.test(f.name))) {
      setError("Choose one or more .txt or .log Workshop logs.");
      return;
    }
    setError(null);
    setBusy(true);
    const ordered = orderUploads(files);
    setItems(ordered.map((file) => ({ file, status: { kind: "queued" } })));
    for (let i = 0; i < ordered.length; i += 1) {
      setStatus(i, { kind: "uploading" });
      setStatus(i, await upload(ordered[i], side));
    }
    setBusy(false);
    form.reset();
    router.refresh();
  }

  async function retry(index: number) {
    const item = items[index];
    if (item.status.kind !== "needs-side") return;
    setBusy(true);
    setStatus(index, { kind: "uploading" });
    setStatus(index, await upload(item.file, item.status.side));
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border border-dashed border-zinc-700 p-4">
      <h2 className="font-medium">Add maps</h2>
      <input name="files" type="file" accept=".txt,.log" multiple required className="block text-sm" />
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <label><input type="radio" name="ourSide" value="auto" defaultChecked /> Detect from players</label>
        <label><input type="radio" name="ourSide" value="1" /> We were Team 1</label>
        <label><input type="radio" name="ourSide" value="2" /> We were Team 2</label>
      </fieldset>
      <button type="submit" disabled={busy} className="rounded bg-orange-500 px-3 py-1 font-medium text-black disabled:opacity-50">
        {busy ? "Uploading..." : "Upload"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items.length > 0 && (
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={item.file.name + i} className="rounded border border-zinc-800 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{item.file.name}</span>
                <StatusBadge status={item.status} />
              </div>
              {item.status.kind === "done" && item.status.warnings.length > 0 && (
                <ul className="mt-1 text-yellow-400">{item.status.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              )}
              {item.status.kind === "error" && <p className="mt-1 text-red-400">{item.status.message}</p>}
              {item.status.kind === "needs-side" && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-zinc-400">Could not tell which team was yours.</p>
                  {(["1", "2"] as const).map((s) => {
                    const st = item.status as Extract<Status, { kind: "needs-side" }>;
                    const name = s === "1" ? st.team1Name : st.team2Name;
                    const names = s === "1" ? st.team1 : st.team2;
                    return (
                      <label key={s} className="block">
                        <input type="radio" name={`side-${i}`} checked={st.side === s} onChange={() => setStatus(i, { ...st, side: s })} /> {name}: {names.join(", ")}
                      </label>
                    );
                  })}
                  <button type="button" disabled={busy} onClick={() => retry(i)} className="rounded bg-zinc-700 px-2 py-0.5">Upload with this side</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const text: Record<Status["kind"], string> = { queued: "Queued", uploading: "Uploading…", done: "Done", "needs-side": "Needs side", duplicate: "Already uploaded", error: "Failed" };
  const tone: Record<Status["kind"], string> = { queued: "bg-zinc-700", uploading: "bg-zinc-700", done: "bg-green-700", "needs-side": "bg-yellow-700", duplicate: "bg-zinc-700", error: "bg-red-700" };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${tone[status.kind]}`}>
      {status.kind === "done" ? `Done · ${status.mapName}` : text[status.kind]}
    </span>
  );
}
