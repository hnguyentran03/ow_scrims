"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "className"> & { label: string; hint: string; error?: string | null };

/** A drop target wrapping a real file input. The label is the input's name; keyboard users tab to the visually hidden input and the label shows the focus ring through `has-focus-visible`; dropped files are assigned to it. */
export function Dropzone({ label, hint, error, onChange, ...input }: Props) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  const assign = (files: FileList | null) => setNames(files ? Array.from(files).map((f) => f.name) : []);

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (ref.current) {
            ref.current.files = e.dataTransfer.files;
            assign(e.dataTransfer.files);
          }
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-card border border-dashed px-4 py-6 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${over ? "border-accent bg-accent/5" : "border-line bg-surface"}`}
      >
        <span className="font-medium text-ink">{label}</span>
        <span className="text-sm text-muted">{hint}</span>
        <input
          {...input}
          id={id}
          ref={ref}
          type="file"
          onChange={(e) => {
            assign(e.target.files);
            onChange?.(e);
          }}
          className="sr-only"
        />
      </label>
      {names.length > 0 && (
        <ul className="text-sm text-muted">
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-lost">{error}</p>}
    </div>
  );
}
