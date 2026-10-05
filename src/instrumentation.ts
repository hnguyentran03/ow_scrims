/** Runs once per server start. Drops sandboxes left by the previous process, then reaps idle ones every few minutes. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Checked before the import: @/lib/db/sandbox loads `pg`, and PGlite-only local dev
  // has no use for it. Next awaits register(), so the sweep finishes before we serve.
  const { sandboxMode } = await import("@/lib/db/sandbox-env");
  if (!sandboxMode()) return;
  const { startSandboxMaintenance } = await import("@/lib/db/sandbox");
  await startSandboxMaintenance();
}
