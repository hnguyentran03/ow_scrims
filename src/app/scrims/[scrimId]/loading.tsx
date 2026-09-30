import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy>
      <Skeleton className="h-8 w-56" />
      <div className="space-y-2 rounded-card border border-line bg-surface p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    </div>
  );
}
