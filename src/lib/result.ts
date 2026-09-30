export type BadgeTone = "won" | "lost" | "neutral" | "warning" | "error";
export type ResultLabel = "Won" | "Lost" | "N/A";

/** The badge tone for a map result label. */
export function resultTone(label: ResultLabel): BadgeTone {
  if (label === "Won") return "won";
  if (label === "Lost") return "lost";
  return "neutral";
}

/** The badge tone for a win/loss record. */
export function recordTone(wins: number, losses: number): BadgeTone {
  if (wins > losses) return "won";
  if (losses > wins) return "lost";
  return "neutral";
}
