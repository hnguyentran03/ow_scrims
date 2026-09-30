import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent px-3 py-1.5 text-ground hover:brightness-110",
  secondary: "border border-line bg-surface px-3 py-1.5 text-ink hover:bg-raised",
  danger: "px-0 py-1.5 text-lost hover:underline",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; pending?: boolean; pendingLabel?: string };

/** The one button. `pending` disables it and swaps the label; `danger` is text-only for deletes. */
export function Button({ variant = "secondary", pending = false, pendingLabel, className = "", children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center gap-2 rounded-control text-base font-medium disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
