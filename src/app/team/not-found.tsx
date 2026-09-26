import Link from "next/link";

export default function TeamNotFound() {
  return (
    <div className="space-y-2">
      <p className="text-zinc-400">No player by that name is on our roster in this range. Widen the dates above, or pick someone from the roster.</p>
      <Link href="/team/players" className="text-zinc-400 hover:underline">Back to players</Link>
    </div>
  );
}
