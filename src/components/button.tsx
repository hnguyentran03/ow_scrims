import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const SIZE: Record<ButtonSize, string> = {
  md: "px-3 py-1.5 text-base",
  sm: "px-2 py-0.5 text-xs",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ground hover:brightness-110",
  secondary: "border border-line bg-surface text-ink hover:bg-raised",
  danger: "px-0 text-lost hover:underline",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; pending?: boolean; pendingLabel?: string };

/** The one button. `pending` disables it and swaps the label; `danger` is text-only for deletes and always keeps `px-0`. */
export function Button({ variant = "secondary", size = "md", pending = false, pendingLabel, className = "", children, disabled, type = "button", ...rest }: Props) {
  // Danger stays flush left (px-0) regardless of size; only its py/text scale with size.
  const sizeClasses = variant === "danger" ? SIZE[size].replace(/(^|\s)px-\S+/, "") : SIZE[size];
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center gap-2 rounded-control font-medium disabled:opacity-50 ${sizeClasses} ${VARIANT[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
