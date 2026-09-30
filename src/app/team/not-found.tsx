import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function TeamNotFound() {
  return (
    <EmptyState
      action={
        <Link href="/team/players" className="text-accent hover:underline">
          Back to players
        </Link>
      }
    >
      No player by that name is on our roster in this range. Widen the dates above, or pick someone from the roster.
    </EmptyState>
  );
}
