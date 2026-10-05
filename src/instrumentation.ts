/** Runs once per server start. Drops sandboxes left by the previous process, then reaps idle ones every few minutes. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSandboxMaintenance } = await import("@/lib/db/sandbox");
  await startSandboxMaintenance();
}
