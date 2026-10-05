import { Button } from "@/components/button";
import { requestSandboxId } from "@/lib/db";
import { sandboxMode } from "@/lib/db/sandbox-env";
import { resetSandboxAction } from "./actions";

/** Tells a visitor whether they are on the shared snapshot or in their own sandbox. Renders nothing outside sandbox mode. */
export async function SandboxBar() {
  if (!sandboxMode()) return null;
  // Imported here rather than at the top: this bar renders on every page, and
  // @/lib/db/sandbox loads `pg`, which local PGlite dev has no use for.
  const { hasLiveSandbox } = await import("@/lib/db/sandbox");
  const id = await requestSandboxId();
  const live = id !== null && hasLiveSandbox(id);
  return (
    <div role="status" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-muted">
        {live ? (
          <>
            <span>You are in a private sandbox. Changes are yours alone and reset after two hours of inactivity.</span>
            <form action={resetSandboxAction}>
              <Button type="submit" size="sm">Reset</Button>
            </form>
          </>
        ) : (
          <span>You are viewing a shared snapshot. Any change you make starts a private sandbox that resets after two hours of inactivity.</span>
        )}
      </div>
    </div>
  );
}
