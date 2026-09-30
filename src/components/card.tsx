export function Card({ title, note, actions, children }: { title: string; note?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg tracking-[0.03em] text-ink">{title}</h2>
        <div className="flex items-center gap-3">
          {note && <span className="text-xs text-muted">{note}</span>}
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}
