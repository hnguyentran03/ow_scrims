import Link from "next/link";

interface Props {
  back?: { href: string; label: string };
  title: string;
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/** The shared page opening: optional back link, title with actions on the right, then a meta line of separate spans. */
export function PageHeader({ back, title, meta, actions, children }: Props) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl tracking-[0.02em] text-ink">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {meta && meta.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}
