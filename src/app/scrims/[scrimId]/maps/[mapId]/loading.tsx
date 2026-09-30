import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="space-y-2 rounded-card border border-line bg-surface p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    </div>
  );
}
