import { describe, expect, it } from "vitest";
import { sandboxEnv } from "@/lib/db/sandbox";
import { databaseUrl } from "@/lib/db/sandbox-postgres";

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
    });
    expect(sandboxEnv({ ...base, SANDBOX_PUBLIC_DB: "pub", SANDBOX_UPLOAD_ROOT: "/tmp/x", SANDBOX_IDLE_MINUTES: "5", SANDBOX_MAX: "3" })).toMatchObject({
      publicDb: "pub",
      uploadRoot: "/tmp/x",
      idleMs: 5 * 60_000,
      max: 3,
    });
    expect(sandboxEnv({ ...base, SANDBOX_IDLE_MINUTES: "junk", SANDBOX_MAX: "0" })).toMatchObject({ idleMs: 120 * 60_000, max: 20 });
  });
});

describe("databaseUrl", () => {
  it("swaps the database name and keeps host, auth, and query", () => {
    expect(databaseUrl("postgres://u:p@localhost:5433/postgres?sslmode=disable", "ow_sb_x")).toBe("postgres://u:p@localhost:5433/ow_sb_x?sslmode=disable");
    expect(databaseUrl("postgres:///postgres?host=/var/run/postgresql", "ow_public")).toBe("postgres:///ow_public?host=/var/run/postgresql");
  });
});
