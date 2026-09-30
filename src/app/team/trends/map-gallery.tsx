import { Card } from "@/components/card";
import { formatPct } from "@/lib/format";
import { RECENT_LIMIT, type MapTile, type Outcome } from "@/lib/stats/map-gallery";

const TONE: Record<Outcome, string> = { won: "bg-won", lost: "bg-lost", undecided: "bg-muted" };
const WORD: Record<Outcome, string> = { won: "won", lost: "lost", undecided: "undecided" };

export function MapGallery({ tiles }: { tiles: MapTile[] }) {
  return (
    <Card title="Maps" note={`Win rate per map with the last ${RECENT_LIMIT} results, oldest first.`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.mapName} className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface p-3">
            <div className="truncate font-display text-lg tracking-[0.03em] text-ink">{t.mapName}</div>
            <div className="font-display text-stat tracking-[0.02em] text-ink">{formatPct(t.winRate)}</div>
            <div className="flex flex-wrap gap-x-3 text-sm text-muted">
              <span>{t.won}-{t.lost}</span>
              {t.undecided > 0 && <span>{t.undecided} undecided</span>}
            </div>
            <div className="flex items-center gap-1" aria-hidden>
              {t.recent.map((o, i) => (
                <span key={i} className={`slant-sm inline-block h-2.5 w-2.5 ${TONE[o]}`} />
              ))}
            </div>
            <span className="sr-only">Recent results: {t.recent.map((o) => WORD[o]).join(", ")}</span>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted">
              <span>{t.mapType}</span>
              <span>last {t.lastPlayed}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
