import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./index";
import { isSandboxId } from "./sandbox-id";
import { PostgresSandboxBackend } from "./sandbox-postgres";
import { SandboxRegistry, type SandboxHandle } from "./sandbox-registry";

export interface SandboxEnv {
  adminUrl: string;
  templateDb: string;
  publicDb: string;
  uploadRoot: string;
  idleMs: number;
  max: number;
}

const DEFAULT_IDLE_MINUTES = 120;
const DEFAULT_MAX = 20;
const REAP_INTERVAL_MS = 5 * 60_000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Sandbox mode needs a Postgres URL and a template name; anything else is today's single-database behaviour. */
export function sandboxEnv(env: Partial<NodeJS.ProcessEnv> = process.env): SandboxEnv | null {
  const url = env.DATABASE_URL ?? "";
  const templateDb = env.SANDBOX_TEMPLATE_DB;
  if (!templateDb || !(url.startsWith("postgres://") || url.startsWith("postgresql://"))) return null;
  return {
    adminUrl: url,
    templateDb,
    publicDb: env.SANDBOX_PUBLIC_DB ?? "ow_public",
    uploadRoot: env.SANDBOX_UPLOAD_ROOT ?? "/var/lib/ow-scrims/sandboxes",
    idleMs: positiveInt(env.SANDBOX_IDLE_MINUTES, DEFAULT_IDLE_MINUTES) * 60_000,
    max: positiveInt(env.SANDBOX_MAX, DEFAULT_MAX),
  };
}

export function sandboxMode(): boolean {
  return sandboxEnv() !== null;
}

interface Runtime {
  env: SandboxEnv;
  backend: PostgresSandboxBackend;
  registry: SandboxRegistry;
  publicHandle: SandboxHandle;
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
      publicHandle: backend.open(env.publicDb),
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

export async function createSandbox(id: string): Promise<Db> {
  return must().registry.create(id);
}

export async function dropSandbox(id: string): Promise<void> {
  await must().registry.drop(id);
}

/** Drops every sandbox database and upload directory left behind by a previous process. Run once at startup, when the registry is empty. */
export async function sweepOrphans(): Promise<void> {
  const rt = must();
  for (const name of await rt.backend.listSandboxDatabases()) await rt.backend.dropDatabase(name);
  let dirs: string[] = [];
  try {
    dirs = await readdir(rt.env.uploadRoot);
  } catch {
    return; // no uploads yet
  }
  for (const d of dirs) if (!rt.registry.has(d)) await rm(path.join(rt.env.uploadRoot, d), { recursive: true, force: true });
}

export async function reapSandboxes(): Promise<string[]> {
  return must().registry.reapIdle();
}

/** Called from instrumentation.ts in the Node runtime. No-op outside sandbox mode. */
export function startSandboxMaintenance(): void {
  if (!runtime()) return;
  sweepOrphans().catch((err) => console.error("sandbox sweep failed", err));
  const timer = setInterval(() => {
    reapSandboxes().catch((err) => console.error("sandbox reap failed", err));
  }, REAP_INTERVAL_MS);
  timer.unref();
}
