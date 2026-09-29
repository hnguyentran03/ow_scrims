"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearCalibrationAction, setCalibrationAction } from "@/app/actions";
import { formatDuration } from "@/lib/format";
import { applyAffine, solveAffine, type Calibration, type Pair } from "@/lib/stats/calibration";

export interface CloudPoint {
  t: number;
  attacker: string;
  victim: string;
  x: number;
  z: number;
}

type Mode = "pair" | "objective";

export function Calibrate({ imageId, calibration, points, sourceLabel }: { imageId: number; calibration: Calibration | null; points: CloudPoint[]; sourceLabel: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pairs, setPairs] = useState<Pair[]>(calibration?.pairs ?? []);
  const [objective, setObjective] = useState<{ px: number; py: number } | null>(
    calibration?.objective ? applyAffine(calibration.affine, calibration.objective) : null,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("pair");
  const [error, setError] = useState<string | null>(null);
  const [imageMissing, setImageMissing] = useState(false);
  const affine = pairs.length >= 3 ? solveAffine(pairs) : null;
  const src = `/api/map-images/${imageId}`;
  const imgRef = useRef<HTMLImageElement>(null);

  // An already-loaded (or already-failed) image — e.g. from a hard reload, where the browser starts the fetch from
  // the SSR HTML before React attaches the load/error listener — never fires `onLoad`/`onError` again after hydration.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth) setSize({ w: el.naturalWidth, h: el.naturalHeight });
    else if (el?.complete && !el.naturalWidth) setImageMissing(true);
  }, [src]);

  function onClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!size) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const { x: px, y: py } = pt.matrixTransform(ctm.inverse());
    if (mode === "objective") {
      setObjective({ px, py });
      setMode("pair");
      return;
    }
    if (selected === null) return;
    const p = points[selected];
    setPairs([...pairs, { world: { x: p.x, z: p.z }, image: { px, py } }]);
    setSelected(null);
    setError(null);
  }

  function save() {
    if (!size) return;
    start(async () => {
      const result = await setCalibrationAction({ id: imageId, pairs, width: size.w, height: size.h, objective });
      setError(result?.error ?? null);
      if (!result) router.refresh();
    });
  }

  function clear() {
    start(async () => {
      await clearCalibrationAction(imageId);
      setPairs([]);
      setObjective(null);
      setError(null);
      router.refresh();
    });
  }

  const r = size ? Math.max(size.w, size.h) * 0.006 : 4;
  const button = "rounded border border-zinc-700 px-2 py-1 text-sm hover:border-zinc-400 disabled:opacity-50";

  return (
    <section className="space-y-3 rounded border border-zinc-800 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">Calibration</h2>
        <span className="text-xs text-zinc-500">{calibration ? `Saved with ${calibration.pairs.length} pairs` : "Not calibrated"}{sourceLabel ? ` · kills from ${sourceLabel}` : ""}</span>
      </div>
      <p className="text-sm text-zinc-400">
        Pick a kill from the list whose spot you remember, then click where it happened on the image. Three pairs spread across the stage
        (the objective, both chokes) are enough; more pairs average out mistakes. Optionally mark the objective centre for the zone-control views.
      </p>
      {points.length === 0 && <p className="text-sm text-zinc-400">No log with position logging has been uploaded for this stage yet, so there is nothing to align. The image is kept; come back after uploading one.</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* The hidden img reports the intrinsic size the SVG viewBox and the saved calibration need. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            className="hidden"
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setImageMissing(true)}
          />
          {!size && imageMissing && <p className="text-sm text-red-400">The image file is missing. Upload it again.</p>}
          {size && (
            <svg viewBox={`0 0 ${size.w} ${size.h}`} className={`w-full rounded border border-zinc-800 ${selected !== null || mode === "objective" ? "cursor-crosshair" : ""}`} onClick={onClick} role="img" aria-label="Stage image">
              <image href={src} width={size.w} height={size.h} />
              {affine && points.map((p, i) => {
                const { px, py } = applyAffine(affine, p);
                return <circle key={i} cx={px} cy={py} r={r} fill={i === selected ? "#f97316" : "#e4e4e7"} opacity={0.8} />;
              })}
              {pairs.map((p, i) => (
                <g key={i} stroke="#22c55e" strokeWidth={r * 0.5}>
                  <line x1={p.image.px - r * 2} x2={p.image.px + r * 2} y1={p.image.py} y2={p.image.py} />
                  <line x1={p.image.px} x2={p.image.px} y1={p.image.py - r * 2} y2={p.image.py + r * 2} />
                </g>
              ))}
              {objective && (
                <g stroke="#facc15" strokeWidth={r * 0.5} fill="none">
                  <circle cx={objective.px} cy={objective.py} r={r * 3} />
                  <line x1={objective.px - r * 4} x2={objective.px + r * 4} y1={objective.py} y2={objective.py} />
                  <line x1={objective.px} x2={objective.px} y1={objective.py - r * 4} y2={objective.py + r * 4} />
                </g>
              )}
            </svg>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode(mode === "objective" ? "pair" : "objective")} aria-pressed={mode === "objective"} className={`${button} ${mode === "objective" ? "border-zinc-100" : ""}`}>
              {mode === "objective" ? "Click the objective centre…" : "Mark objective centre"}
            </button>
            {objective && <button type="button" onClick={() => setObjective(null)} className={button}>Remove objective mark</button>}
            <button type="button" onClick={save} disabled={pending || !size || pairs.length < 3} className={`${button} ml-auto border-orange-500`}>Save calibration</button>
            {calibration && <button type="button" onClick={clear} disabled={pending} className={button}>Clear saved</button>}
          </div>
          {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
          {!affine && pairs.length > 0 && pairs.length < 3 && <p className="mt-1 text-sm text-zinc-400">{3 - pairs.length} more pair{pairs.length === 2 ? "" : "s"} needed for a preview.</p>}
          {!affine && pairs.length >= 3 && <p className="mt-1 text-sm text-zinc-400">These pairs lie on one line; add a pair somewhere else.</p>}
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Pairs</h3>
            {pairs.length === 0 ? <p className="text-zinc-400">None yet.</p> : (
              <ul className="space-y-1">
                {pairs.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 tabular-nums">
                    <span>({p.world.x.toFixed(1)}, {p.world.z.toFixed(1)}) → ({Math.round(p.image.px)}, {Math.round(p.image.py)})</span>
                    <button type="button" aria-label="Remove pair" onClick={() => { setPairs(pairs.filter((_, j) => j !== i)); setError(null); }} className="text-zinc-400 hover:text-zinc-100">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Kills on this stage</h3>
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {points.map((p, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setSelected(selected === i ? null : i)} aria-pressed={selected === i} className={`w-full text-left hover:bg-zinc-900 ${selected === i ? "text-orange-400" : ""}`}>
                    <span className="tabular-nums text-zinc-400">{formatDuration(p.t)}</span> {p.attacker} → {p.victim}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
