export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-stat tracking-[0.02em] text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
