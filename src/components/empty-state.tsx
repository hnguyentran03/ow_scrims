/** A directive empty state: one sentence saying what to do next, and optionally the control that does it. */
export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 text-base text-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}
