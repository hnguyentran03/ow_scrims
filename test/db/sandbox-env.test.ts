import { afterEach, describe, expect, it, vi } from "vitest";
import { sandboxEnv, sandboxMaxMaps } from "@/lib/db/sandbox-env";
import { databaseUrl } from "@/lib/db/sandbox-postgres";

afterEach(() => vi.unstubAllEnvs());

describe("sandboxEnv", () => {
  it("is off without a Postgres URL or without a template name", () => {
    expect(sandboxEnv({})).toBeNull();
    expect(sandboxEnv({ DATABASE_URL: "memory://", SANDBOX_TEMPLATE_DB: "ow_template" })).toBeNull();
    expect(sandboxEnv({ DATABASE_URL: "postgres://localhost/postgres" })).toBeNull();
  });
  it("reads the defaults and the overrides", () => {
    const base = { DATABASE_URL: "postgres://localhost/postgres", SANDBOX_TEMPLATE_DB: "ow_template" };
    expect(sandboxEnv(base)).toEqual({
      adminUrl: "postgres://localhost/postgres",
      templateDb: "ow_template",
      publicDb: "ow_public",
      uploadRoot: "/var/lib/ow-scrims/sandboxes",
      idleMs: 120 * 60_000,
      max: 20,
      maxMaps: 40,
      createsPerMinute: 10,
    });
    expect(sandboxEnv({ ...base, SANDBOX_PUBLIC_DB: "pub", SANDBOX_UPLOAD_ROOT: "/tmp/x", SANDBOX_IDLE_MINUTES: "5", SANDBOX_MAX: "3" })).toMatchObject({
      publicDb: "pub",
      uploadRoot: "/tmp/x",
      idleMs: 5 * 60_000,
      max: 3,
    });
    expect(sandboxEnv({ ...base, SANDBOX_IDLE_MINUTES: "junk", SANDBOX_MAX: "0" })).toMatchObject({ idleMs: 120 * 60_000, max: 20 });
  });
  it("reads the per-sandbox map quota and the create throttle, falling back on junk", () => {
    const base = { DATABASE_URL: "postgres://localhost/postgres", SANDBOX_TEMPLATE_DB: "ow_template" };
    expect(sandboxEnv({ ...base, SANDBOX_MAX_MAPS: "7", SANDBOX_CREATES_PER_MINUTE: "2" })).toMatchObject({ maxMaps: 7, createsPerMinute: 2 });
    expect(sandboxEnv({ ...base, SANDBOX_MAX_MAPS: "-1", SANDBOX_CREATES_PER_MINUTE: "junk" })).toMatchObject({ maxMaps: 40, createsPerMinute: 10 });
  });
});

describe("sandboxMaxMaps", () => {
  it("defaults to 40 and follows the environment override", () => {
    expect(sandboxMaxMaps()).toBe(40);
    vi.stubEnv("DATABASE_URL", "postgres://localhost/postgres");
    vi.stubEnv("SANDBOX_TEMPLATE_DB", "ow_template");
    vi.stubEnv("SANDBOX_MAX_MAPS", "5");
    expect(sandboxMaxMaps()).toBe(5);
  });
});

describe("databaseUrl", () => {
  it("swaps the database name and keeps host, auth, and query", () => {
    expect(databaseUrl("postgres://u:p@localhost:5433/postgres?sslmode=disable", "ow_sb_x")).toBe("postgres://u:p@localhost:5433/ow_sb_x?sslmode=disable");
    expect(databaseUrl("postgres:///postgres?host=/var/run/postgresql", "ow_public")).toBe("postgres:///ow_public?host=/var/run/postgresql");
  });
});
