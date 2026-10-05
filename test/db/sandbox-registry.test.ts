import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { SandboxRegistry, type SandboxBackend, type SandboxHandle } from "@/lib/db/sandbox-registry";

function fakeBackend() {
  const created: string[] = [];
  const destroyed: string[] = [];
  let release: (() => void) | null = null;
  const backend: SandboxBackend = {
    async create(id) {
      created.push(id);
      if (release) await new Promise<void>((r) => (release = r));
      const handle: SandboxHandle = { db: { id } as unknown as Db, close: async () => {} };
      return handle;
    },
    async destroy(id) {
      destroyed.push(id);
    },
  };
  return { backend, created, destroyed, hold: () => (release = () => {}), free: () => release?.() };
}

const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32);

describe("SandboxRegistry", () => {
  it("returns null for an unknown id without creating anything", async () => {
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 1000, max: 5 });
    expect(await reg.get(A)).toBeNull();
    expect(f.created).toEqual([]);
  });

  it("creates once and shares the in-flight creation", async () => {
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 1000, max: 5 });
    const [x, y] = await Promise.all([reg.create(A), reg.create(A)]);
    expect(x).toBe(y);
    expect(f.created).toEqual([A]);
    expect(reg.has(A)).toBe(true);
    expect(await reg.get(A)).toBe(x);
  });

  it("forgets a sandbox whose creation failed", async () => {
    const backend: SandboxBackend = { create: async () => { throw new Error("boom"); }, destroy: async () => {} };
    const reg = new SandboxRegistry(backend, { idleMs: 1000, max: 5 });
    await expect(reg.create(A)).rejects.toThrow("boom");
    expect(reg.has(A)).toBe(false);
  });

  it("evicts the least recently seen sandbox at the cap", async () => {
    let t = 0;
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 10_000, max: 2, now: () => t });
    await reg.create(A); t = 1;
    await reg.create(B); t = 2;
    await reg.get(A); t = 3;           // A is now newer than B
    await reg.create(C);
    expect(f.destroyed).toEqual([B]);
    expect(reg.ids().sort()).toEqual([A, C].sort());
  });

  it("reaps sandboxes idle past the limit and keeps the rest", async () => {
    let t = 0;
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 100, max: 5, now: () => t });
    await reg.create(A); t = 50;
    await reg.create(B); t = 149;
    await reg.get(B);                  // B seen at 149
    t = 200;
    expect(await reg.reapIdle()).toEqual([A]);
    expect(f.destroyed).toEqual([A]);
    expect(reg.has(B)).toBe(true);
    expect(reg.size).toBe(1);
  });

  it("drop is a no-op for an unknown id and destroys a known one", async () => {
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 1000, max: 5 });
    await reg.drop(A);
    expect(f.destroyed).toEqual([]);
    await reg.create(A);
    await reg.drop(A);
    expect(f.destroyed).toEqual([A]);
    expect(reg.has(A)).toBe(false);
  });

  it("keeps the cap under concurrent creates", async () => {
    let t = 0;
    const f = fakeBackend();
    const reg = new SandboxRegistry(f.backend, { idleMs: 10_000, max: 2, now: () => t });
    await reg.create(A); t = 1;
    await reg.create(B); t = 2;
    const D = "d".repeat(32);
    await Promise.all([reg.create(C), reg.create(D)]);
    expect(reg.size).toBe(2);
    expect(f.destroyed.sort()).toEqual([A, B].sort());
    expect(reg.ids().sort()).toEqual([C, D].sort());
  });

  it("reapIdle continues after a destroy failure", async () => {
    let t = 0;
    let destroyCount = 0;
    const f = fakeBackend();
    const backend: SandboxBackend = {
      async create(id) {
        await f.backend.create(id);
        const handle: SandboxHandle = { db: { id } as unknown as Db, close: async () => {} };
        return handle;
      },
      async destroy(id, handle) {
        destroyCount++;
        if (destroyCount === 1) throw new Error("destroy failed");
        await f.backend.destroy(id, handle);
      },
    };
    const reg = new SandboxRegistry(backend, { idleMs: 100, max: 5, now: () => t });
    await reg.create(A); t = 50;
    await reg.create(B); t = 149;
    t = 200;
    const reaped = await reg.reapIdle();
    expect(reaped).toEqual([B]);
    expect(reg.size).toBe(0);
  });
});
