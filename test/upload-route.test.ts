import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";

let probe: Db;
const writableCalls: string[] = [];

// The route must settle everything it can against the read database before asking for a
// writable one, so these two stand in for the real accessors and record which were used.
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    getDb: async () => probe,
    getWritableSandbox: async () => {
      writableCalls.push("getWritableSandbox");
      return { db: probe, sandboxId: null };
    },
  };
});

const { POST } = await import("@/app/api/scrims/[scrimId]/maps/route");

const call = (scrimId: string, body?: BodyInit, headers: Record<string, string> = { "content-length": "0" }) =>
  POST(new Request("http://x/api", { method: "POST", headers, body }), { params: Promise.resolve({ scrimId }) } as never);

function form(filename: string, text: string): FormData {
  const fd = new FormData();
  fd.set("file", new File([text], filename, { type: "text/plain" }));
  fd.set("ourSide", "1");
  return fd;
}

const post = (scrimId: string, fd: FormData) => call(scrimId, fd, { "content-length": "1" });

beforeAll(async () => {
  probe = await createTestDb();
  await createScrim(probe, { name: "vs X", date: "2026-09-17", opponentName: "X" });
});
beforeEach(() => {
  writableCalls.length = 0;
  vi.unstubAllEnvs();
});

describe("upload route id parsing", () => {
  it.each(["0", "-1", "1.5", "01", "2147483648", "abc"])("rejects %s with 400", async (id) => {
    const res = await call(id);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid scrim id" });
  });

  it("passes a valid id through the guard", async () => {
    const res = await call("1");
    const body = await res.json();
    expect(body).not.toEqual({ error: "invalid scrim id" });
  });
});

describe("upload route validation order", () => {
  it("names the configured cap when content-length is over it, without reading the body", async () => {
    vi.stubEnv("MAX_UPLOAD_MB", "1");
    const res = await call("1", undefined, { "content-length": String(2 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "file is larger than 1 MB" });
    expect(writableCalls).toEqual([]);
  });

  it("404s an unknown scrim against the read database, creating no sandbox", async () => {
    const res = await post("999999", form("log.txt", readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8")));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "scrim not found" });
    expect(writableCalls).toEqual([]);
  });

  it("refuses an unparseable file before creating a sandbox", async () => {
    const res = await post("1", form("stub.txt", "nonsense"));
    expect(res.status).toBe(400);
    expect(writableCalls).toEqual([]);
  });

  it("refuses a wrong extension before creating a sandbox", async () => {
    const res = await post("1", form("log.csv", readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8")));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "upload a .txt or .log Workshop log" });
    expect(writableCalls).toEqual([]);
  });
});
