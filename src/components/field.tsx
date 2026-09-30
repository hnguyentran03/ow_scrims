import { cloneElement, useId, type InputHTMLAttributes, type ReactElement, type SelectHTMLAttributes } from "react";

export type ControlSize = "sm" | "md";

const SIZE: Record<ControlSize, string> = {
  md: "px-2 py-1.5 text-base",
  sm: "px-1 py-0.5 text-xs",
};

const CONTROL = "rounded-control border border-line bg-raised text-ink placeholder:text-muted aria-invalid:border-lost";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: ControlSize };

export function Input({ size = "md", className = "", ...props }: InputProps) {
  return <input {...props} className={`${CONTROL} ${SIZE[size]} ${className}`} />;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: ControlSize };

export function Select({ size = "md", className = "", ...props }: SelectProps) {
  return <select {...props} className={`${CONTROL} ${SIZE[size]} ${className}`} />;
}

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** One labelled control with an optional hint and an inline error, wired through aria-describedby and aria-invalid. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactElement<ControlProps> }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">{label}</label>
      {cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-lost">{error}</p>}
    </div>
  );
}
