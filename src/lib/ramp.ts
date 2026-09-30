export type RampStep = 0 | 1 | 2 | 3 | 4;

/** A share in [0, 1] onto the five-step blue ramp; null (no data) sits on the base step. */
export function rampStep(share: number | null): RampStep {
  if (share === null) return 0;
  return Math.round(Math.min(1, Math.max(0, share)) * 4) as RampStep;
}

/** Full class names so Tailwind's scanner sees them. */
export const RAMP_CLASS: Record<RampStep, string> = { 0: "bg-ramp-0", 1: "bg-ramp-1", 2: "bg-ramp-2", 3: "bg-ramp-3", 4: "bg-ramp-4" };

/** Ink clears 4.5:1 on steps 0 to 3; the deepest step (bg-ramp-4) is too light for ink, so it uses ground text instead. */
export const RAMP_TEXT: Record<RampStep, string> = { 0: "text-ink", 1: "text-ink", 2: "text-ink", 3: "text-ink", 4: "text-ground" };
