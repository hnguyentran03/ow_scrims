import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const SIZE: Record<ButtonSize, string> = { md: "h-8 px-4 text-md", sm: "h-6 px-3 text-sm" };

const VARIANT: Record<ButtonVariant, string> = {
  primary: "slant bg-accent text-ground font-display tracking-[0.06em]",
  secondary: "slant bg-raised text-ink font-display tracking-[0.06em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-line",
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
