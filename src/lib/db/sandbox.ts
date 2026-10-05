import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./index";
import { RateWindow } from "./rate-window";
import { isSandboxId, SANDBOX_DB_PREFIX } from "./sandbox-id";
import { sandboxEnv, type SandboxEnv } from "./sandbox-env";
import { PostgresSandboxBackend } from "./sandbox-postgres";
import { SandboxRegistry, type SandboxHandle } from "./sandbox-registry";

// Re-exported so callers that only need the configuration can import "./sandbox-env"
// (no `pg`), while the existing import sites keep working.
export { sandboxEnv, sandboxMaxMaps, sandboxMode, type SandboxEnv } from "./sandbox-env";

/** The shared read copy serves every visitor without a sandbox, so it keeps its own, larger pool. */
const PUBLIC_POOL_MAX = 4;
const REAP_INTERVAL_MS = 5 * 60_000;
const CREATE_WINDOW_MS = 60_000;

/** Thrown when the per-minute clone budget is spent. The caller should ask the visitor to retry. */
export class SandboxBusyError extends Error {
  constructor() {
    super("too many new sandboxes right now, try again in a minute");
    this.name = "SandboxBusyError";
  }
}

interface Runtime {
  env: SandboxEnv;
  backend: PostgresSandboxBackend;
  registry: SandboxRegistry;
  publicHandle: SandboxHandle;
  creates: RateWindow;
}

// One runtime per process, on globalThis so dev hot-reloads reuse it.
const g = globalThis as unknown as { __owSandbox?: Runtime };

function runtime(): Runtime | null {
  const env = sandboxEnv();
  if (!env) return null;
  if (!g.__owSandbox) {
    const backend = new PostgresSandboxBackend(env);
    g.__owSandbox = {
      env,
      backend,
      registry: new SandboxRegistry(backend, { idleMs: env.idleMs, max: env.max }),
      publicHandle: backend.open(env.publicDb, PUBLIC_POOL_MAX, { readOnly: true }),
      creates: new RateWindow(env.createsPerMinute, CREATE_WINDOW_MS),
    };
  }
  return g.__owSandbox;
}

function must(): Runtime {
  const rt = runtime();
  if (!rt) throw new Error("sandbox mode is off");
  return rt;
}

export function sandboxLogDir(id: string): string {
  if (!isSandboxId(id)) throw new Error("invalid sandbox id");
  return path.join(must().env.uploadRoot, id);
}

export async function publicDb(): Promise<Db> {
  return must().publicHandle.db;
}

export function hasLiveSandbox(id: string): boolean {
  return runtime()?.registry.has(id) ?? false;
}

export async function liveSandboxDb(id: string): Promise<Db | null> {
  return must().registry.get(id);
}

/** Clones the template for this id. Throws SandboxBusyError when this minute's clone budget is spent. */
export async function createSandbox(id: string): Promise<Db> {
  const rt = must();
  // Checked before the registry hears about the id, so a throttled create leaves nothing behind.
  if (!rt.creates.tryTake()) throw new SandboxBusyError();
  return rt.registry.create(id);
}

export async function dropSandbox(id: string): Promise<void> {
  await must().registry.drop(id);
}

/**
 * Drops the sandbox databases and upload directories left behind by a previous process.
 * Anything this process has registered is skipped, and only names that are sandbox ids
 * are touched, so a sibling directory under the upload root is never removed.
 */
export async function sweepOrphans(): Promise<void> {
  const rt = must();
  for (const name of await rt.backend.listSandboxDatabases()) {
    const id = name.slice(SANDBOX_DB_PREFIX.length);
    if (isSandboxId(id) && !rt.registry.has(id)) await rt.backend.dropDatabase(name);
  }
  let dirs: string[] = [];
  try {
    dirs = await readdir(rt.env.uploadRoot);
  } catch {
    return; // no uploads yet
  }
  for (const d of dirs) if (isSandboxId(d) && !rt.registry.has(d)) await rm(path.join(rt.env.uploadRoot, d), { recursive: true, force: true });
}

export async function reapSandboxes(): Promise<string[]> {
  return must().registry.reapIdle();
}

/**
 * Called from instrumentation.ts in the Node runtime, which awaits it: the sweep must
 * finish before the first request can register a sandbox the sweep would then drop.
 * No-op outside sandbox mode.
 */
export async function startSandboxMaintenance(): Promise<void> {
  if (!runtime()) return;
  try {
    await sweepOrphans();
  } catch (err) {
    console.error("sandbox sweep failed", err);
  }
  const timer = setInterval(() => {
    reapSandboxes().catch((err) => console.error("sandbox reap failed", err));
  }, REAP_INTERVAL_MS);
  timer.unref();
}
