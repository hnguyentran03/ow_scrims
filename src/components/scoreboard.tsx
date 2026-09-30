const PLATE = "relative flex min-w-0 gap-1 px-4 py-4 stripes sm:flex-row sm:items-center sm:gap-3";
const NAME = "min-w-0 max-w-full truncate font-display text-lg tracking-[0.04em] text-ink";
const NUMERAL = "font-display text-xl leading-none text-ink sm:text-display";

/** The map page hero: two angled team plates meeting at a VS cell, ours on the blue plate and theirs on the rose one. Children render in a row below. */
export function Scoreboard({ ours, theirs, children }: { ours: { name: string; score: string }; theirs: { name: string; score: string }; children?: React.ReactNode }) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
        <div className={`${PLATE} flex-col items-end bg-plate-ours sm:justify-end [clip-path:polygon(0_0,100%_0,calc(100%-14px)_100%,0_100%)]`}>
          <span className={NAME}>{ours.name}</span>
          <span className={NUMERAL}>{ours.score}</span>
        </div>
        <div className="flex items-center bg-surface px-3 font-display text-md tracking-[0.1em] text-muted">VS</div>
        <div className={`${PLATE} flex-col-reverse items-start bg-plate-theirs sm:justify-start [clip-path:polygon(14px_0,100%_0,100%_100%,0_100%)]`}>
          <span className={NUMERAL}>{theirs.score}</span>
          <span className={NAME}>{theirs.name}</span>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-3 text-sm text-muted">{children}</div>}
    </div>
  );
}
