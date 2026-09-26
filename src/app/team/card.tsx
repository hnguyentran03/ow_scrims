export function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded border border-zinc-800 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}
