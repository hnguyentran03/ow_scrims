"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddMapForm({ scrimId }: { scrimId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !/\.(txt|log)$/i.test(file.name)) {
      setError("Choose a .txt or .log Workshop log.");
      return;
    }
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/scrims/${scrimId}/maps`, { method: "POST", body: data });
      const body = (await res.json()) as { error?: string; warnings?: string[] };
      if (!res.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      setWarnings(body.warnings ?? []);
      form.reset();
      router.refresh();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border border-dashed border-zinc-700 p-4">
      <h2 className="font-medium">Add map</h2>
      <input name="file" type="file" accept=".txt,.log" required className="block text-sm" />
      <fieldset className="flex gap-4 text-sm">
        <label><input type="radio" name="ourSide" value="1" defaultChecked /> We were Team 1</label>
        <label><input type="radio" name="ourSide" value="2" /> We were Team 2</label>
      </fieldset>
      <button type="submit" disabled={busy} className="rounded bg-orange-500 px-3 py-1 font-medium text-black disabled:opacity-50">
        {busy ? "Uploading..." : "Upload"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {warnings.length > 0 && (
        <ul className="text-sm text-yellow-400">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </form>
  );
}
