export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function resultLabel(map: { ourSide: number; winnerSide: number | null }): "Won" | "Lost" | "N/A" {
  if (map.winnerSide === null) return "N/A";
  return map.winnerSide === map.ourSide ? "Won" : "Lost";
}

export function formatPct(v: number | null): string {
  return v === null ? "–" : `${Math.round(v * 100)}%`;
}

export function formatSeconds(v: number | null): string {
  return v === null ? "–" : `${Math.round(v)}s`;
}
