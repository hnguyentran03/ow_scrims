import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const SIZE: Record<ButtonSize, string> = { md: "h-8 px-4 text-md", sm: "h-6 px-3 text-sm" };

// clip-path clips the global outline ring away, so the slanted variants draw their focus ring as an inset shadow instead.
// Primary is already filled with accent, so its accent ring needs a ground-coloured hairline inside it to read at all.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "slant bg-accent text-ground font-display tracking-[0.06em] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent),inset_0_0_0_4px_var(--color-ground)]",
  secondary:
    "slant bg-raised text-ink font-display tracking-[0.06em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-line focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent),inset_0_0_0_1px_var(--color-line)]",
  danger: "px-0 font-sans text-base text-lost hover:underline",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; pending?: boolean; pendingLabel?: string };

/** The one button. `pending` disables it and swaps the label; `danger` is text-only for deletes and always keeps `px-0`. */
export function Button({ variant = "secondary", size = "md", pending = false, pendingLabel, className = "", children, disabled, type = "button", ...rest }: Props) {
  // Danger stays flush left (px-0) and at the body text size regardless of size; only its height scales with size.
  const sizeClasses = variant === "danger" ? SIZE[size].replace(/(^|\s)(px|text)-\S+/g, "") : SIZE[size];
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 leading-none disabled:opacity-50 ${sizeClasses} ${VARIANT[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
