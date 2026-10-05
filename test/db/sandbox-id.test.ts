import { describe, expect, it } from "vitest";
import { isSandboxId, newSandboxId, SANDBOX_COOKIE, SANDBOX_DB_PREFIX, sandboxDbName } from "@/lib/db/sandbox-id";

describe("sandbox ids", () => {
  it("generates 32 lowercase hex characters", () => {
    const id = newSandboxId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(newSandboxId()).not.toBe(id);
  });
  it("accepts only 32 lowercase hex characters", () => {
    expect(isSandboxId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isSandboxId("0123456789ABCDEF0123456789abcdef")).toBe(false);
    expect(isSandboxId("0123456789abcdef0123456789abcde")).toBe(false);
    expect(isSandboxId('x"; drop database ow_public; --')).toBe(false);
    expect(isSandboxId(undefined)).toBe(false);
    expect(isSandboxId(42)).toBe(false);
  });
  it("names the database from a valid id only", () => {
    expect(sandboxDbName("0123456789abcdef0123456789abcdef")).toBe("ow_sb_0123456789abcdef0123456789abcdef");
    expect(() => sandboxDbName("nope")).toThrow("invalid sandbox id");
    expect(SANDBOX_DB_PREFIX).toBe("ow_sb_");
    expect(SANDBOX_COOKIE).toBe("sb");
  });
});
