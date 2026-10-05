import type { Db } from "./index";

export interface SandboxHandle {
  db: Db;
  close(): Promise<void>;
}

/** What the registry needs from the database layer. The Postgres implementation lives in sandbox-postgres.ts; tests use a fake. */
export interface SandboxBackend {
  /** Clone the template into a database for this id and open a pool to it. */
  create(id: string): Promise<SandboxHandle>;
  /** Close the pool (when one was opened), drop the database, delete the upload directory. */
  destroy(id: string, handle: SandboxHandle | null): Promise<void>;
}

export interface RegistryOptions {
  idleMs: number;
  max: number;
  now?: () => number;
}

interface Entry {
  ready: Promise<SandboxHandle>;
  lastSeen: number;
}

/**
 * The in-memory table of live sandboxes for this process. Last-seen times live
 * only here, so a restart forgets every sandbox; the startup sweep in sandbox.ts
 * drops the databases they left behind.
 */
export class SandboxRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => number;

  constructor(private readonly backend: SandboxBackend, private readonly opts: RegistryOptions) {
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  /** The live sandbox's database, bumping its last-seen time; null when none is registered. Never creates. */
  async get(id: string): Promise<Db | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;
    entry.lastSeen = this.now();
    return (await entry.ready).db;
  }

  /** Creates the sandbox, or joins a creation already in flight. At the cap, the least recently seen sandbox is dropped first. */
  async create(id: string): Promise<Db> {
    const existing = this.entries.get(id);
    if (existing) {
      existing.lastSeen = this.now();
      return (await existing.ready).db;
    }
    // Registered before CREATE DATABASE runs, so concurrent requests share this promise
    // and the reaper never treats a half-made sandbox as unknown.
    const ready = this.backend.create(id);
    this.entries.set(id, { ready, lastSeen: this.now() });
    try {
      // Evict in a loop after registering, so concurrent insertions all see the true size
      while (this.entries.size > this.opts.max) {
        const oldest = this.oldestId();
        if (!oldest || oldest === id) break;
        await this.drop(oldest);
      }
      return (await ready).db;
    } catch (err) {
      this.entries.delete(id);
      throw err;
    }
  }

  async drop(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    let handle: SandboxHandle | null;
    try {
      handle = await entry.ready;
    } catch {
      handle = null;
    }
    await this.backend.destroy(id, handle);
  }

  /** Drops every sandbox not seen within idleMs. Returns the ids it dropped. */
  async reapIdle(): Promise<string[]> {
    const cutoff = this.now() - this.opts.idleMs;
    const stale = [...this.entries].filter(([, e]) => e.lastSeen <= cutoff).map(([id]) => id);
    const dropped: string[] = [];
    for (const id of stale) {
      try {
        await this.drop(id);
        dropped.push(id);
      } catch (err) {
        console.error("sandbox drop failed", id, err);
      }
    }
    return dropped;
  }

  private oldestId(): string | undefined {
    let best: { id: string; t: number } | undefined;
    for (const [id, e] of this.entries) if (!best || e.lastSeen < best.t) best = { id, t: e.lastSeen };
    return best?.id;
  }
}
