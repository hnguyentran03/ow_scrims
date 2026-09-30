import type { BadgeTone } from "@/lib/result";

const TONE: Record<BadgeTone, string> = {
  won: "bg-won/15 text-won",
  lost: "bg-lost/15 text-lost",
  neutral: "bg-raised text-muted",
  warning: "bg-accent/15 text-accent",
  error: "bg-lost/15 text-lost",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center slant-sm font-display text-sm tracking-[0.06em] px-2.5 py-px leading-[18px] ${TONE[tone]}`}>{children}</span>;
}
